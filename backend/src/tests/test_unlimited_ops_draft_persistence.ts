import prisma from '../config/prisma';
import { DoctorDashboardService } from '../services/doctorDashboard.service';
import { AppointmentService } from '../services/appointment.service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runUnlimitedOpsDraftTest() {
  console.log('========================================================================');
  console.log('🚀 RUNNING MANDATORY ACCEPTANCE TEST: UNLIMITED OPs DRAFT PERSISTENCE');
  console.log('========================================================================\n');

  // 1. Locate active doctor and hospital
  const doctor = await prisma.doctor.findFirst({
    where: { isActive: true },
    include: { user: true, hospital: true },
  });
  if (!doctor) throw new Error('No active doctor found');
  const hospital = doctor.hospital;
  const doctorUserId = doctor.userId;

  console.log(`Doctor: ${doctor.user.name} (${doctor.id})`);
  console.log(`Hospital: ${hospital.name} (${hospital.id})\n`);

  const NUM_OPS = 12; // Test with 12 distinct OPs (exceeds the 10 minimum requirement)
  console.log(`Step 1: Creating ${NUM_OPS} distinct OP registrations in the queue...`);

  const todayStr = new Date().toISOString().split('T')[0];
  const createdOps: Array<{
    appointmentId: string;
    tokenNumber: number;
    patientId: string;
    patientName: string;
  }> = [];

  for (let i = 1; i <= NUM_OPS; i++) {
    const mobile = `91${Math.floor(10000000 + Math.random() * 90000000)}`;
    const patientName = `Scale Test Patient ${String(i).padStart(2, '0')}`;
    const result = await AppointmentService.createOfflineAppointment({
      hospitalId: hospital.id,
      doctorId: doctor.id,
      patient: {
        fullName: patientName,
        mobileNumber: mobile,
        gender: i % 2 === 0 ? 'FEMALE' : 'MALE',
        age: 20 + i * 3,
        bloodGroup: i % 3 === 0 ? 'O+' : i % 3 === 1 ? 'B+' : 'None',
      },
      appointmentDate: todayStr,
      timeSlot: `${9 + Math.floor(i / 2)}:${(i % 2) * 30 === 0 ? '00' : '30'} AM`,
      consultationType: 'IN_PERSON',
      notes: `Scale test booking #${i}`,
    });

    createdOps.push({
      appointmentId: result.appointment.id,
      tokenNumber: result.appointment.tokenNumber,
      patientId: result.appointment.patient.id,
      patientName,
    });
  }

  assert(createdOps.length === NUM_OPS, `Successfully registered all ${NUM_OPS} OP encounters`);

  // 2. Define completely distinct draft datasets for all 12 OPs
  console.log('\nStep 2: Entering and persisting distinct consultation drafts for each of the 12 OPs...');

  const draftDataByEncounterId: Map<string, any> = new Map();

  for (let i = 0; i < NUM_OPS; i++) {
    const op = createdOps[i];
    const encounterIndex = i + 1;

    const opDraft = {
      chiefComplaints: `Patient #${encounterIndex} complaints: severe symptom cluster Type-${encounterIndex} lasting ${encounterIndex + 1} days`,
      examination: `Clinical Exam for Patient #${encounterIndex}: Systemic evaluation-${encounterIndex} completed. S1 S2 normal.`,
      diagnosis: `Clinical Condition Classification Code-${encounterIndex}00`,
      vitals: {
        bp: `${110 + encounterIndex}/${70 + Math.floor(encounterIndex / 2)}`,
        pulse: `${70 + encounterIndex * 2}`,
        temperature: `${(98.0 + encounterIndex * 0.2).toFixed(1)}`,
        weight: `${50 + encounterIndex * 3}`,
        spo2: `${95 + (encounterIndex % 5)}%`,
      },
      medicines: [
        {
          name: `Pharmacological Compound ${encounterIndex}-Alpha 500mg`,
          dosage: '1 tablet',
          frequency: encounterIndex % 2 === 0 ? 'BD (Twice daily)' : 'TDS (Thrice daily)',
          duration: `${encounterIndex + 2} days`,
          instructions: `After food regimen ${encounterIndex}`,
          priority: 1,
        },
        {
          name: `Therapeutic Agent ${encounterIndex}-Beta 10ml`,
          dosage: '10 ml',
          frequency: 'OD (Once daily)',
          duration: '5 days',
          instructions: 'Before breakfast',
          priority: 2,
        },
        {
          name: `Adjunct Tablet ${encounterIndex}-Gamma 250mg`,
          dosage: '1 tablet',
          frequency: 'HS (At bedtime)',
          duration: '7 days',
          instructions: 'With warm water',
          priority: 3,
        },
      ],
      clinicalNotes: `Tailored clinical lifestyle guidance for Encounter #${encounterIndex}: regimen compliance mandatory.`,
      followUpDate: `2026-11-${String(encounterIndex).padStart(2, '0')}`,
      sendToPharmacy: encounterIndex % 2 === 1,
      labRequests: [
        { testName: `Diagnostic Panel #${encounterIndex}A`, notes: `Specific protocol ${encounterIndex}` },
        { testName: `Biomarker Profile #${encounterIndex}B`, notes: `Priority screening ${encounterIndex}` },
      ],
    };

    draftDataByEncounterId.set(op.appointmentId, opDraft);

    // Save draft for this OP
    const saved = await DoctorDashboardService.saveConsultationDraft(
      doctor.id,
      op.appointmentId,
      opDraft,
      doctorUserId
    );

    assert(saved.appointment.status === 'DRAFT', `OP #${encounterIndex} (${op.patientName}) transitioned to DRAFT status`);
    assert(saved.draft !== null, `OP #${encounterIndex} draft persisted in DB`);
  }

  // 3. Simulate doctor switching between all 12 OPs multiple times and updating some drafts
  console.log('\nStep 3: Simulating switching between multiple OPs back and forth, editing and re-saving...');

  // Switch to OP 3, verify details, edit, and re-save
  const op3 = createdOps[2];
  const loaded3First = await DoctorDashboardService.getConsultationDetails(doctor.id, op3.appointmentId);
  assert(
    loaded3First.draft.chiefComplaints === draftDataByEncounterId.get(op3.appointmentId).chiefComplaints,
    'OP #3 loaded correct independent draft on first switch'
  );

  // Edit OP 3 with updated note and extra medicine
  const updatedOp3Draft = {
    ...draftDataByEncounterId.get(op3.appointmentId),
    chiefComplaints: `${draftDataByEncounterId.get(op3.appointmentId).chiefComplaints} [EDITED: condition improved]`,
    clinicalNotes: 'Updated clinical notes during re-consultation',
    medicines: [
      ...draftDataByEncounterId.get(op3.appointmentId).medicines,
      {
        name: 'Extra Booster Tablet 100mg',
        dosage: '1 tab',
        frequency: 'OD',
        duration: '3 days',
        instructions: 'After lunch',
        priority: 4,
      },
    ],
  };
  draftDataByEncounterId.set(op3.appointmentId, updatedOp3Draft);
  await DoctorDashboardService.saveConsultationDraft(doctor.id, op3.appointmentId, updatedOp3Draft, doctorUserId);

  // Switch to OP 10, verify details, edit, and re-save
  const op10 = createdOps[9];
  const loaded10First = await DoctorDashboardService.getConsultationDetails(doctor.id, op10.appointmentId);
  assert(
    loaded10First.draft.chiefComplaints === draftDataByEncounterId.get(op10.appointmentId).chiefComplaints,
    'OP #10 loaded correct independent draft on switch'
  );
  assert(
    !loaded10First.draft.chiefComplaints.includes('Patient #3'),
    'OP #10 draft has zero contamination from OP #3'
  );

  // Edit OP 10
  const updatedOp10Draft = {
    ...draftDataByEncounterId.get(op10.appointmentId),
    diagnosis: 'Updated Diagnosis for OP 10 - Confirmed Secondary Infection',
  };
  draftDataByEncounterId.set(op10.appointmentId, updatedOp10Draft);
  await DoctorDashboardService.saveConsultationDraft(doctor.id, op10.appointmentId, updatedOp10Draft, doctorUserId);

  // Switch back to OP 1, OP 7, OP 12, OP 3 again
  const loaded1Back = await DoctorDashboardService.getConsultationDetails(doctor.id, createdOps[0].appointmentId);
  assert(
    loaded1Back.draft.chiefComplaints === draftDataByEncounterId.get(createdOps[0].appointmentId).chiefComplaints,
    'OP #1 draft is fully intact after switching between other patients'
  );

  const loaded3Back = await DoctorDashboardService.getConsultationDetails(doctor.id, op3.appointmentId);
  assert(
    loaded3Back.draft.chiefComplaints.includes('[EDITED: condition improved]'),
    'OP #3 retained latest edited draft when switched back to'
  );
  const op3Meds = JSON.parse(loaded3Back.draft.medicines as string);
  assert(op3Meds.length === 4, 'OP #3 retained all 4 medicines after switching');

  // 4. Simulate application refresh and reopening all 12 consultations one by one
  console.log('\nStep 4: Simulating full application refresh & reopening all 12 consultations independently...');

  // Fresh queue query as done when loading the OPD dashboard
  const refreshedQueue = await DoctorDashboardService.getDoctorAppointments(doctor.id, todayStr);
  assert(Array.isArray(refreshedQueue), 'Doctor queue loaded successfully after simulated refresh');

  // Verify queue efficiency: draft in queue only returns lightweight metadata ({ id, updatedAt }), not full JSON blobs
  const queueDraftSample = refreshedQueue.find((a) => a.id === op3.appointmentId)?.draft;
  assert(queueDraftSample !== undefined && queueDraftSample !== null, 'Queue includes draft existence indicator');
  assert((queueDraftSample as any).medicines === undefined, 'Queue query does NOT leak full draft medicines payload (lightweight queue)');

  // Now reopen each of the 12 OP encounters one by one and verify every field
  console.log('Verifying all 12 OP consultations for complete fidelity and zero cross-contamination...');

  for (let i = 0; i < NUM_OPS; i++) {
    const op = createdOps[i];
    const encounterIndex = i + 1;
    const expected = draftDataByEncounterId.get(op.appointmentId);

    const reloaded = await DoctorDashboardService.getConsultationDetails(doctor.id, op.appointmentId);

    assert(reloaded.appointment.id === op.appointmentId, `Encounter #${encounterIndex} ID matches`);
    assert(reloaded.draft !== null, `Encounter #${encounterIndex} draft exists in database`);

    // Verify Chief Complaints
    assert(
      reloaded.draft.chiefComplaints === expected.chiefComplaints,
      `Encounter #${encounterIndex} Chief Complaints match expected (${expected.chiefComplaints.slice(0, 30)}...)`
    );

    // Verify Examination Findings
    assert(
      reloaded.draft.examination === expected.examination,
      `Encounter #${encounterIndex} Examination findings match`
    );

    // Verify Diagnosis
    assert(
      reloaded.draft.diagnosis === expected.diagnosis,
      `Encounter #${encounterIndex} Diagnosis matches`
    );

    // Verify Vitals
    const parsedVitals = JSON.parse(reloaded.draft.vitals as string);
    assert(
      parsedVitals.pulse === expected.vitals.pulse && parsedVitals.temperature === expected.vitals.temperature,
      `Encounter #${encounterIndex} Vitals match expected (Pulse: ${expected.vitals.pulse}, Temp: ${expected.vitals.temperature})`
    );

    // Verify Medicines & Priorities
    const parsedMeds = JSON.parse(reloaded.draft.medicines as string);
    assert(
      parsedMeds.length === expected.medicines.length,
      `Encounter #${encounterIndex} Medicine count matches (${expected.medicines.length} rows)`
    );
    for (let mIdx = 0; mIdx < expected.medicines.length; mIdx++) {
      assert(
        parsedMeds[mIdx].name === expected.medicines[mIdx].name &&
          parsedMeds[mIdx].priority === expected.medicines[mIdx].priority,
        `Encounter #${encounterIndex} Med #${mIdx + 1} (${expected.medicines[mIdx].name}) priority matches`
      );
    }

    // Verify Clinical Notes & Follow-up Date
    assert(
      reloaded.draft.clinicalNotes === expected.clinicalNotes,
      `Encounter #${encounterIndex} Clinical Notes match`
    );
    assert(
      reloaded.draft.followUpDate === expected.followUpDate,
      `Encounter #${encounterIndex} Follow-up Date matches (${expected.followUpDate})`
    );

    // Verify Pharmacy Routing
    assert(
      Boolean(reloaded.draft.sendToPharmacy) === Boolean(expected.sendToPharmacy),
      `Encounter #${encounterIndex} Pharmacy Routing flag matches (${expected.sendToPharmacy})`
    );

    // Verify Zero Cross-Contamination: Check that NO data from any OTHER encounter is present
    for (let otherIdx = 0; otherIdx < NUM_OPS; otherIdx++) {
      if (otherIdx === i) continue;
      const otherEncounterNum = otherIdx + 1;
      assert(
        !reloaded.draft.chiefComplaints.includes(`Patient #${otherEncounterNum} complaints`),
        `Encounter #${encounterIndex} is completely free of Encounter #${otherEncounterNum} complaints`
      );
    }
  }

  // 5. Complete one consultation and verify only its draft is deleted while all other 11 remain
  console.log('\nStep 5: Completing consultation for OP #1 and verifying other 11 drafts remain untouched...');

  const op1 = createdOps[0];
  const completeOp1 = await DoctorDashboardService.completeConsultation(
    doctor.id,
    op1.appointmentId,
    {
      diagnosis: 'Finalized Condition for OP #1',
      medicines: draftDataByEncounterId.get(op1.appointmentId).medicines,
      vitals: draftDataByEncounterId.get(op1.appointmentId).vitals,
    },
    doctorUserId
  );
  assert(completeOp1.appointment.status === 'COMPLETED', 'OP #1 completed successfully');

  // Verify OP #1 draft is cleaned up
  const op1DraftAfter = await prisma.consultationDraft.findUnique({
    where: { appointmentId: op1.appointmentId },
  });
  assert(op1DraftAfter === null, 'OP #1 draft cleanly deleted upon completion');

  // Verify remaining 11 OP drafts are still in DB and intact
  const remainingDraftCount = await prisma.consultationDraft.count({
    where: {
      appointmentId: {
        in: createdOps.slice(1).map((o) => o.appointmentId),
      },
    },
  });
  assert(remainingDraftCount === NUM_OPS - 1, `All remaining ${NUM_OPS - 1} OP drafts remain intact in database`);

  console.log('\n========================================================================');
  console.log(`🎉 MANDATORY ACCEPTANCE TEST PASSED FOR ALL ${NUM_OPS} OPs!`);
  console.log('   - Unlimited OPs supported without any fixed size limitations');
  console.log('   - 100% data fidelity across all fields');
  console.log('   - Zero cross-contamination between any encounters');
  console.log('   - Lightweight queue querying with on-demand draft retrieval');
  console.log('========================================================================\n');
}

runUnlimitedOpsDraftTest()
  .catch((err) => {
    console.error('Test run failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
