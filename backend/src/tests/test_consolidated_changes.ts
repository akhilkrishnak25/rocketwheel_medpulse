import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import prisma from '../config/prisma';
import { DoctorDashboardService } from '../services/doctorDashboard.service';
import { AppointmentService } from '../services/appointment.service';
import { PharmacyService } from '../services/pharmacy.service';
import { LabService } from '../services/lab.service';
import { AdminService } from '../services/admin.service';
import { generateClinicalConsultationPdf } from '../utils/pdf';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASSED: ${message}`);
}

function extractPdfText(pdfBuffer: Buffer): string {
  const chunks: Buffer[] = [pdfBuffer];
  let searchPos = 0;
  const streamHeader = Buffer.from('stream\n');
  const streamHeaderCrLf = Buffer.from('stream\r\n');
  const endStream = Buffer.from('endstream');

  while (searchPos < pdfBuffer.length) {
    let start = pdfBuffer.indexOf(streamHeader, searchPos);
    let offset = 7;
    if (start === -1) {
      start = pdfBuffer.indexOf(streamHeaderCrLf, searchPos);
      offset = 8;
    }
    if (start === -1) break;

    const end = pdfBuffer.indexOf(endStream, start + offset);
    if (end === -1) break;

    const streamData = pdfBuffer.subarray(start + offset, end);
    try {
      const inflated = zlib.inflateSync(streamData);
      chunks.push(inflated);
    } catch {
      chunks.push(streamData);
    }
    searchPos = end + 9;
  }

  const extractedLines: string[] = [];

  for (const chunk of chunks) {
    const s = chunk.toString('latin1');

    // Match TJ arrays: [ ... ] TJ
    const tjRegex = /\[([\s\S]*?)\]\s*TJ/g;
    let match: RegExpExecArray | null;
    while ((match = tjRegex.exec(s)) !== null) {
      const arrayContent = match[1];
      let tjLine = '';
      const tokenRegex = /<([0-9a-fA-F\s]+)>|\(([^)]*)\)/g;
      let tm: RegExpExecArray | null;
      while ((tm = tokenRegex.exec(arrayContent)) !== null) {
        if (tm[1] !== undefined) {
          const clean = tm[1].replace(/\s+/g, '');
          if (clean.length % 2 === 0) {
            tjLine += Buffer.from(clean, 'hex').toString('latin1');
          }
        } else if (tm[2] !== undefined) {
          tjLine += tm[2];
        }
      }
      if (tjLine.trim()) {
        extractedLines.push(tjLine);
      }
    }

    // Match standalone Tj: <hex> Tj or (string) Tj
    const tjSingleRegex = /<([0-9a-fA-F\s]+)>\s*Tj|\(([^)]*)\)\s*Tj/g;
    let singleMatch: RegExpExecArray | null;
    while ((singleMatch = tjSingleRegex.exec(s)) !== null) {
      if (singleMatch[1] !== undefined) {
        const clean = singleMatch[1].replace(/\s+/g, '');
        if (clean.length % 2 === 0) {
          extractedLines.push(Buffer.from(clean, 'hex').toString('latin1'));
        }
      } else if (singleMatch[2] !== undefined) {
        extractedLines.push(singleMatch[2]);
      }
    }
  }

  return extractedLines.join('\n');
}

async function main() {
  console.log('================================================================');
  console.log('🚀 RUNNING ACCEPTANCE TESTS FOR CONSOLIDATED CHANGE REQUEST');
  console.log('================================================================\n');

  // Find an active doctor, hospital and admin user for testing
  const doctor = await prisma.doctor.findFirst({
    where: { isActive: true },
    include: { user: true, hospital: true },
  });
  if (!doctor) throw new Error('No doctor found in database for testing');

  const hospital = doctor.hospital;
  const doctorUserId = doctor.userId;

  console.log(`Doctor: ${doctor.user.name} (${doctor.id})`);
  console.log(`Hospital: ${hospital.name} (${hospital.id})\n`);

  // -------------------------------------------------------------------------
  // ACCEPTANCE TEST 9 & 10: Walk-in OP Registration - Optional Blood Group
  // -------------------------------------------------------------------------
  console.log('--- Acceptance Test 9 & 10: Walk-in OP Registration with Optional / None Blood Group ---');

  // 9. Register a walk-in OP with no blood group (undefined / empty)
  const mobile1 = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
  const walkin1 = await AppointmentService.createOfflineAppointment({
    hospitalId: hospital.id,
    doctorId: doctor.id,
    patient: {
      fullName: 'Walkin Test Patient NoBlood',
      mobileNumber: mobile1,
      gender: 'MALE',
      age: 32,
      bloodGroup: undefined, // omitted / undefined
    },
    appointmentDate: new Date().toISOString().split('T')[0],
    timeSlot: '10:00 AM',
    consultationType: 'IN_PERSON',
    notes: 'Testing Walk-in registration with no blood group',
  });

  assert(walkin1 !== null, 'Walk-in OP registration succeeded with no blood group');
  assert(walkin1.appointment.status === 'CONFIRMED' || walkin1.appointment.status === 'WAITING', 'Appointment created in confirmed/waiting status');
  
  const createdPatient1 = await prisma.patient.findUnique({
    where: { id: walkin1.appointment.patient.id },
  });
  assert(createdPatient1?.bloodGroup === null, 'Patient bloodGroup is null in database when not provided');

  // 10. Register a walk-in OP with "None" selected
  const mobile2 = `97${Math.floor(10000000 + Math.random() * 90000000)}`;
  const walkin2 = await AppointmentService.createOfflineAppointment({
    hospitalId: hospital.id,
    doctorId: doctor.id,
    patient: {
      fullName: 'Walkin Test Patient NoneBlood',
      mobileNumber: mobile2,
      gender: 'FEMALE',
      age: 28,
      bloodGroup: 'None', // Passed "None"
    },
    appointmentDate: new Date().toISOString().split('T')[0],
    timeSlot: '10:30 AM',
    consultationType: 'IN_PERSON',
  });

  const createdPatient2 = await prisma.patient.findUnique({
    where: { id: walkin2.appointment.patient.id },
  });
  assert(createdPatient2?.bloodGroup === null, 'Patient bloodGroup is null in database when "None" was selected (not string "None")');

  // 10b. Verify existing patient with blood group preserves their blood group if re-booked
  const mobile3 = `96${Math.floor(10000000 + Math.random() * 90000000)}`;
  const walkinWithBlood = await AppointmentService.createOfflineAppointment({
    hospitalId: hospital.id,
    doctorId: doctor.id,
    patient: {
      fullName: 'Existing Blood Patient',
      mobileNumber: mobile3,
      gender: 'MALE',
      age: 45,
      bloodGroup: 'B+',
    },
    appointmentDate: new Date().toISOString().split('T')[0],
    timeSlot: '11:00 AM',
  });
  assert(walkinWithBlood.appointment.patient.bloodGroup === 'B+', 'Patient created with B+ blood group');

  // Re-book same patient passing 'None' for blood group: existing blood group must be preserved!
  const walkinRebook = await AppointmentService.createOfflineAppointment({
    hospitalId: hospital.id,
    doctorId: doctor.id,
    patient: {
      fullName: 'Existing Blood Patient',
      mobileNumber: mobile3,
      bloodGroup: 'None',
    },
    appointmentDate: new Date().toISOString().split('T')[0],
    timeSlot: '11:15 AM',
  });
  const rebookedPatient = await prisma.patient.findUnique({
    where: { id: walkinWithBlood.appointment.patient.id },
  });
  assert(rebookedPatient?.bloodGroup === 'B+', 'Existing patient B+ blood group was preserved when rebooking with "None"');

  // -------------------------------------------------------------------------
  // ACCEPTANCE TESTS 1, 2, 5: Clinical Consultation Draft Persistence
  // -------------------------------------------------------------------------
  console.log('\n--- Acceptance Tests 1, 2, 5: Save Partially Filled Draft & Verify Persistence ---');

  const aptA = walkin1.appointment;

  // 1 & 2. Save a partially filled consultation draft (without mandatory diagnosis, with multiple medicines & priorities)
  const draftDataA = {
    chiefComplaints: 'Intermittent fever x 4 days, severe dry cough, headache',
    examination: 'Chest clear, throat mildly congested, pulse regular',
    diagnosis: '', // Partial draft - diagnosis omitted
    vitals: {
      bp: '130/85',
      pulse: '84',
      temperature: '100.2',
      weight: '72',
      spo2: '98%',
    },
    medicines: [
      {
        name: 'Tab Paracetamol 650mg',
        priority: 1,
        dosage: '1 tablet',
        frequency: 'TDS (Thrice daily)',
        duration: '3 days',
        instructions: 'After meals',
      },
      {
        name: 'Syp Ascoril D 10ml',
        priority: 2,
        dosage: '10 ml',
        frequency: 'BD (Twice daily)',
        duration: '5 days',
        instructions: 'After meals',
      },
      {
        name: 'Cap Amoxicillin 500mg',
        priority: 3,
        dosage: '1 capsule',
        frequency: 'TDS (Thrice daily)',
        duration: '5 days',
        instructions: 'After food',
      },
    ],
    clinicalNotes: 'Drink plenty of warm water. Review in OPD if fever persists beyond 3 days.',
    followUpDate: '2026-10-30',
    sendToPharmacy: true,
    labRequests: [
      { testName: 'Complete Blood Count (CBC)', notes: 'Check for leukocytosis' },
      { testName: 'Widal Test', notes: 'Rule out typhoid' },
    ],
  };

  const savedDraftA = await DoctorDashboardService.saveConsultationDraft(
    doctor.id,
    aptA.id,
    draftDataA,
    doctorUserId
  );

  assert(savedDraftA.appointment.status === 'DRAFT', 'Appointment status transitioned to DRAFT');
  assert(savedDraftA.draft !== null, 'ConsultationDraft record created');
  assert(savedDraftA.draft.chiefComplaints === draftDataA.chiefComplaints, 'Draft chief complaints persisted');
  assert(savedDraftA.draft.examination === draftDataA.examination, 'Draft examination persisted');

  // Parse restored medicines and vitals
  const restoredMedsA = JSON.parse(savedDraftA.draft.medicines as string);
  assert(Array.isArray(restoredMedsA) && restoredMedsA.length === 3, 'All 3 medicine rows persisted in draft');
  assert(restoredMedsA[0].priority === 1 && restoredMedsA[0].name === 'Tab Paracetamol 650mg', 'Priority 1 medicine persisted');
  assert(restoredMedsA[1].priority === 2 && restoredMedsA[1].name === 'Syp Ascoril D 10ml', 'Priority 2 medicine persisted');
  assert(restoredMedsA[2].priority === 3 && restoredMedsA[2].name === 'Cap Amoxicillin 500mg', 'Priority 3 medicine persisted');

  const restoredVitalsA = JSON.parse(savedDraftA.draft.vitals as string);
  assert(restoredVitalsA.bp.includes('130/85') && restoredVitalsA.pulse === '84' && restoredVitalsA.temperature === '100.2', 'All vitals persisted in draft');

  const restoredLabsA = JSON.parse(savedDraftA.draft.labRequests as string);
  assert(Array.isArray(restoredLabsA) && restoredLabsA.length === 2, 'Lab requests persisted in draft');

  // 1b. Test Reopening the consultation: getConsultationDetails retrieves saved draft
  const reopenedDetailsA = await DoctorDashboardService.getConsultationDetails(doctor.id, aptA.id);
  assert(reopenedDetailsA.appointment.status === 'DRAFT', 'Reopened appointment has status DRAFT');
  assert(reopenedDetailsA.draft !== null, 'Reopened appointment returns saved draft object');
  assert(reopenedDetailsA.draft.chiefComplaints === draftDataA.chiefComplaints, 'Reopened draft has correct chiefComplaints');

  // 5. Verify saving a draft does NOT complete consultation or trigger downstream pharmacy / lab orders
  assert(reopenedDetailsA.appointment.prescription === null, 'No finalized prescription was issued for DRAFT');
  
  const pharmacyOrders = await PharmacyService.getPrescriptions();
  const foundInPharmacy = pharmacyOrders.find((p) => p.appointmentId === aptA.id);
  assert(foundInPharmacy === undefined, 'DRAFT consultation is NOT dispatched to pharmacy queue');

  const labRequisitions = await LabService.getTestRequests(hospital.id);
  const foundInLabs = labRequisitions.find((r) => r.appointmentId === aptA.id);
  assert(foundInLabs === undefined, 'DRAFT consultation lab requests are NOT dispatched for laboratory processing');

  // -------------------------------------------------------------------------
  // ACCEPTANCE TEST 3: Multi-Patient OP Isolation (No Data Mixing)
  // -------------------------------------------------------------------------
  console.log('\n--- Acceptance Test 3: Multi-Patient OP Isolation (Process another OP and return) ---');

  const aptB = walkin2.appointment;

  const draftDataB = {
    chiefComplaints: 'Severe migraine headache x 2 days, photophobia, nausea',
    examination: 'Pupils reactive, no focal neurological deficits',
    diagnosis: 'Acute Migraine without Aura',
    vitals: {
      bp: '110/70',
      pulse: '72',
      temperature: '98.4',
      weight: '55',
      spo2: '99%',
    },
    medicines: [
      {
        name: 'Tab Naproxen 500mg',
        priority: 1,
        dosage: '1 tablet',
        frequency: 'SOS (When required)',
        duration: '3 days',
        instructions: 'After food',
      },
    ],
    clinicalNotes: 'Dark room rest, avoid digital screens',
    sendToPharmacy: false,
  };

  const savedDraftB = await DoctorDashboardService.saveConsultationDraft(
    doctor.id,
    aptB.id,
    draftDataB,
    doctorUserId
  );

  assert(savedDraftB.appointment.status === 'DRAFT', 'Patient B consultation saved as DRAFT');

  // Verify Patient A's draft is untouched and completely isolated
  const checkAAfterB = await DoctorDashboardService.getConsultationDetails(doctor.id, aptA.id);
  assert(checkAAfterB.draft.chiefComplaints === draftDataA.chiefComplaints, 'Patient A draft data intact after saving Patient B');
  const parsedMedsAAfterB = JSON.parse(checkAAfterB.draft.medicines as string);
  assert(parsedMedsAAfterB.length === 3 && parsedMedsAAfterB[0].name === 'Tab Paracetamol 650mg', 'Patient A medicines isolated from Patient B');

  // Verify Patient B's draft is correct
  const checkB = await DoctorDashboardService.getConsultationDetails(doctor.id, aptB.id);
  assert(checkB.draft.chiefComplaints === draftDataB.chiefComplaints, 'Patient B draft data correctly retrieved');
  const parsedMedsB = JSON.parse(checkB.draft.medicines as string);
  assert(parsedMedsB.length === 1 && parsedMedsB[0].name === 'Tab Naproxen 500mg', 'Patient B medicines isolated from Patient A');

  // -------------------------------------------------------------------------
  // ACCEPTANCE TEST 4: Edit and Re-save Draft (Updates without Duplication)
  // -------------------------------------------------------------------------
  console.log('\n--- Acceptance Test 4: Edit Existing Draft and Verify In-Place Update ---');

  const draftCountBefore = await prisma.consultationDraft.count({
    where: { appointmentId: aptA.id },
  });
  assert(draftCountBefore === 1, 'Initially exactly 1 draft record for appointment A');

  // Edit draft with updated symptoms and extra medicine
  const updatedDraftA = {
    ...draftDataA,
    chiefComplaints: 'Intermittent fever x 4 days, severe dry cough, headache - IMPROVING on rest',
    clinicalNotes: 'Updated clinical advice: continue hydration, steam inhalation added',
    medicines: [
      ...draftDataA.medicines,
      {
        name: 'Tab Vitamin C 500mg',
        priority: 4,
        dosage: '1 chewable tablet',
        frequency: 'OD (Once daily)',
        duration: '10 days',
        instructions: 'After breakfast',
      },
    ],
  };

  await DoctorDashboardService.saveConsultationDraft(
    doctor.id,
    aptA.id,
    updatedDraftA,
    doctorUserId
  );

  const draftCountAfter = await prisma.consultationDraft.count({
    where: { appointmentId: aptA.id },
  });
  assert(draftCountAfter === 1, 'Draft was updated in place with NO duplication (still exactly 1 draft record)');

  const verifiedUpdatedDraftA = await DoctorDashboardService.getConsultationDetails(doctor.id, aptA.id);
  assert(
    verifiedUpdatedDraftA.draft.chiefComplaints === updatedDraftA.chiefComplaints,
    'Updated chiefComplaints retrieved from updated draft'
  );
  const updatedMeds = JSON.parse(verifiedUpdatedDraftA.draft.medicines as string);
  assert(updatedMeds.length === 4, 'Updated draft contains 4 medicines now');
  assert(updatedMeds[3].name === 'Tab Vitamin C 500mg', 'Added medicine persisted in updated draft');

  // -------------------------------------------------------------------------
  // ACCEPTANCE TEST 6: Complete & Issue Prescription Workflow
  // -------------------------------------------------------------------------
  console.log('\n--- Acceptance Test 6: Complete & Issue Prescription Workflow & Draft Cleanup ---');

  const completeResult = await DoctorDashboardService.completeConsultation(
    doctor.id,
    aptA.id,
    {
      diagnosis: 'Viral Upper Respiratory Infection with Bronchitis',
      chiefComplaints: updatedDraftA.chiefComplaints,
      examination: updatedDraftA.examination,
      clinicalNotes: updatedDraftA.clinicalNotes,
      followUpDate: updatedDraftA.followUpDate,
      vitals: updatedDraftA.vitals,
      medicines: updatedDraftA.medicines,
      sendToPharmacy: true,
      labRequests: [
        { testName: 'Complete Blood Count (CBC)', notes: 'Urgent' },
      ],
    },
    doctorUserId
  );

  assert(completeResult.appointment.status === 'COMPLETED', 'Appointment status transitioned to COMPLETED');
  assert(completeResult.prescription !== null, 'Prescription was created upon completion');
  assert(completeResult.medicalRecord !== null, 'Medical record created upon completion');

  // Verify draft record was cleaned up upon completion
  const draftAfterCompletion = await prisma.consultationDraft.findUnique({
    where: { appointmentId: aptA.id },
  });
  assert(draftAfterCompletion === null, 'ConsultationDraft was cleanly removed from DB after consultation completion');

  // Verify prescription is now visible in pharmacy
  const pharmacyAfterCompletion = await PharmacyService.getPrescriptions();
  const aptAPharmacy = pharmacyAfterCompletion.find((p) => p.appointmentId === aptA.id);
  assert(aptAPharmacy !== undefined, 'Completed consultation prescription is now in pharmacy queue');

  // -------------------------------------------------------------------------
  // ACCEPTANCE TEST 7: Exclude Cancelled Lab Tests from PDFs & Remove Status Labels
  // -------------------------------------------------------------------------
  console.log('\n--- Acceptance Test 7: Exclude Cancelled Lab Tests & Remove Status Column/Labels ---');

  const pdfDataWithMixedLabs = {
    appointmentNumber: 'APT-LAB-TEST-001',
    consultationDate: '2026-10-25',
    tokenNumber: 12,
    letterheadHeight: 144,
    compress: false,
    hospital: {
      name: hospital.name,
      address: hospital.address,
      city: hospital.city,
      phone: hospital.phone,
      email: hospital.email,
    },
    doctor: {
      name: doctor.user.name,
      qualification: doctor.qualification,
      specialization: doctor.specialization,
      department: doctor.department,
      registrationNumber: doctor.registrationNumber,
    },
    patient: {
      fullName: 'Lab Test Patient Mixed',
      patientIdNumber: 'MRN-LAB-001',
      mobileNumber: '9876543210',
      age: 40,
      gender: 'MALE',
      bloodGroup: null, // Null blood group to test display formatting
    },
    vitals: { bp: '120/80', pulse: 76, temperature: 98.4 },
    diagnosis: 'Acute Gastroenteritis',
    // 2 active tests, 2 cancelled tests
    labRequests: [
      { name: 'Serum Electrolytes (Na+, K+, Cl-)', status: 'PENDING', category: 'Biochemistry' },
      { name: 'Cancelled Stool Routine', status: 'CANCELLED', category: 'Microbiology' },
      { name: 'Ultrasound Abdomen & Pelvis', status: 'COMPLETED', category: 'Radiology' },
      { name: 'Rejected Blood Culture', status: 'REJECTED', category: 'Microbiology' },
    ],
    medicines: [
      {
        name: 'ORS Sachet',
        priority: 1,
        dosage: '1 sachet',
        frequency: 'As needed',
        duration: '3 days',
        instructions: 'Mix in 1 litre water',
      },
    ],
  };

  const mixedPdfBuffer = await generateClinicalConsultationPdf(pdfDataWithMixedLabs);
  const mixedPdfText = extractPdfText(mixedPdfBuffer);

  // Active tests must be present
  assert(mixedPdfText.includes('Serum Electrolytes'), 'Active test "Serum Electrolytes" is present in PDF');
  assert(mixedPdfText.includes('Ultrasound Abdomen & Pelvis'), 'Active test "Ultrasound Abdomen & Pelvis" is present in PDF');

  // Cancelled & rejected tests must be completely excluded
  assert(!mixedPdfText.includes('Cancelled Stool Routine'), 'Cancelled test "Cancelled Stool Routine" is NOT in PDF');
  assert(!mixedPdfText.includes('Rejected Blood Culture'), 'Rejected test "Rejected Blood Culture" is NOT in PDF');

  // Status column & labels must be removed entirely
  assert(!mixedPdfText.includes('PENDING'), 'Status label "PENDING" is NOT present in PDF');
  assert(!mixedPdfText.includes('COMPLETED'), 'Status label "COMPLETED" is NOT present in PDF');
  assert(!mixedPdfText.includes('CANCELLED'), 'Status label "CANCELLED" is NOT present in PDF');
  assert(!mixedPdfText.includes('REJECTED'), 'Status label "REJECTED" is NOT present in PDF');

  // Verify blood group display when null
  assert(mixedPdfText.includes('Blood: Not specified'), 'Null blood group is rendered as "Blood: Not specified" in PDF');

  // -------------------------------------------------------------------------
  // ACCEPTANCE TEST 8: Omit Laboratory Test Section When All Tests Are Cancelled
  // -------------------------------------------------------------------------
  console.log('\n--- Acceptance Test 8: Omit Section 5 Entirely When All Lab Tests Are Cancelled ---');

  const pdfDataWithAllCancelledLabs = {
    ...pdfDataWithMixedLabs,
    labRequests: [
      { name: 'Test 1 Cancelled', status: 'CANCELLED' },
      { name: 'Test 2 Canceled', status: 'CANCELED' },
      { name: 'Test 3 Rejected', status: 'REJECTED' },
    ],
  };

  const allCancelledPdfBuffer = await generateClinicalConsultationPdf(pdfDataWithAllCancelledLabs);
  const allCancelledPdfText = extractPdfText(allCancelledPdfBuffer);

  assert(!allCancelledPdfText.includes('DIAGNOSTIC INVESTIGATIONS / RADIOLOGY:'), 'Section 5 DIAGNOSTIC INVESTIGATIONS is completely omitted when all tests are cancelled');
  assert(!allCancelledPdfText.includes('Test 1 Cancelled'), 'No cancelled test names present');

  // -------------------------------------------------------------------------
  // ACCEPTANCE TEST 11: Queue & Dashboard Stats Compatibility
  // -------------------------------------------------------------------------
  console.log('\n--- Acceptance Test 11: Queue & Dashboard Stats Compatibility ---');

  const queue = await DoctorDashboardService.getDoctorAppointments(doctor.id, new Date().toISOString().split('T')[0]);
  assert(Array.isArray(queue), 'Doctor queue returns array');
  
  const draftInQueue = queue.find((a) => a.id === aptB.id);
  assert(draftInQueue !== undefined, 'Draft appointment B appears in doctor queue');
  assert(draftInQueue?.status === 'DRAFT', 'Appointment B has status DRAFT in doctor queue');
  assert(draftInQueue?.draft !== undefined, 'Queue item includes draft relation');

  const stats = await DoctorDashboardService.getDoctorStats(doctor.id);
  assert(stats.todayQueue !== undefined, 'Doctor stats includes todayQueue');

  console.log('\n================================================================');
  console.log('🎉 ALL 11 ACCEPTANCE TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
}

main()
  .catch((err) => {
    console.error('Test run failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
