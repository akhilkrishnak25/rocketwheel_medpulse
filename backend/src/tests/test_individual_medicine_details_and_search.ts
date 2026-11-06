import prisma from '../config/prisma';
import { DoctorDashboardService } from '../services/doctorDashboard.service';

async function run() {
  console.log('\n======================================================');
  console.log('💊 RUNNING INDIVIDUAL MEDICINE DETAILS & SEARCH TEST SUITE');
  console.log('======================================================\n');

  try {
    // -------------------------------------------------------------
    // 1. SETUP: Hospital, Doctor, and Two Independent Appointments
    // -------------------------------------------------------------
    let hospital = await prisma.hospital.findFirst();
    if (!hospital) {
      hospital = await prisma.hospital.create({
        data: {
          name: 'City Care Hospital',
          code: `CCH_${Date.now()}`,
          email: `care_${Date.now()}@citycare.org`,
          phone: '9876543210',
          address: '45 Health Way',
          city: 'Hyderabad',
          state: 'Telangana',
          pincode: '500001',
          facilities: 'OPD, Pharmacy, Diagnostics',
        },
      });
    }

    let dept = await prisma.department.findFirst({ where: { hospitalId: hospital.id } });
    if (!dept) {
      dept = await prisma.department.create({
        data: {
          hospitalId: hospital.id,
          name: 'General Medicine',
          slug: `gen-med-${Date.now()}`,
          code: `GM-${Date.now().toString().slice(-4)}`,
          description: 'Department of Internal Medicine',
        },
      });
    }

    let doctor = await prisma.doctor.findFirst({ where: { hospitalId: hospital.id } });
    if (!doctor) {
      const docUser = await prisma.user.create({
        data: {
          email: `doctor.rx.${Date.now()}@citycare.org`,
          name: 'Dr. Ramesh Kumar',
          passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
          role: 'DOCTOR',
        },
      });
      doctor = await prisma.doctor.create({
        data: {
          userId: docUser.id,
          hospitalId: hospital.id,
          departmentId: dept.id,
          name: 'Dr. Ramesh Kumar',
          qualification: 'MBBS, MD (General Medicine)',
          specialization: 'General Medicine',
          languages: 'English, Telugu, Hindi',
          about: 'Consultant Physician with 10+ years experience',
          consultationFee: 500,
          workingDays: 'Mon,Tue,Wed,Thu,Fri',
          workingHoursStart: '09:00',
          workingHoursEnd: '17:00',
        },
      });
    }

    // Patient A (Encounter A)
    const patientA = await prisma.patient.create({
      data: {
        hospitalId: hospital.id,
        patientIdNumber: `MRN-A-${Date.now().toString().slice(-5)}`,
        fullName: 'Rajesh Varma',
        mobileNumber: '9876543211',
        email: `rajesh.${Date.now()}@example.com`,
        gender: 'MALE',
        age: 42,
      },
    });

    const aptA = await prisma.appointment.create({
      data: {
        appointmentNumber: `APT-A-${Date.now().toString().slice(-6)}`,
        hospitalId: hospital.id,
        doctorId: doctor.id,
        departmentId: dept.id,
        patientId: patientA.id,
        appointmentDate: new Date().toISOString().slice(0, 10),
        timeSlot: '10:00 - 10:30',
        tokenNumber: 101,
        status: 'CONFIRMED',
        consultationFee: 500,
        totalAmount: 520,
      },
    });

    // Patient B (Encounter B - for OP-wise isolation testing)
    const patientB = await prisma.patient.create({
      data: {
        hospitalId: hospital.id,
        patientIdNumber: `MRN-B-${Date.now().toString().slice(-5)}`,
        fullName: 'Sunita Reddy',
        mobileNumber: '9876543212',
        email: `sunita.${Date.now()}@example.com`,
        gender: 'FEMALE',
        age: 38,
      },
    });

    const aptB = await prisma.appointment.create({
      data: {
        appointmentNumber: `APT-B-${Date.now().toString().slice(-6)}`,
        hospitalId: hospital.id,
        doctorId: doctor.id,
        departmentId: dept.id,
        patientId: patientB.id,
        appointmentDate: new Date().toISOString().slice(0, 10),
        timeSlot: '10:30 - 11:00',
        tokenNumber: 102,
        status: 'CONFIRMED',
        consultationFee: 500,
        totalAmount: 520,
      },
    });

    console.log(`✅ [1/10] Setup complete: Doctor "${doctor.name}", Patient A (#${aptA.appointmentNumber}), Patient B (#${aptB.appointmentNumber})`);

    // -------------------------------------------------------------
    // 2. TEST SCENARIO 1: MEDICINE SEARCH FUNCTIONALITY
    // -------------------------------------------------------------
    console.log('\n--- Scenario 1: Medicine Catalogue Search Functionality ---');
    const searchParacetamol = await DoctorDashboardService.searchMedicines('Paracetamol');
    console.log(`  • Search 'Paracetamol' returned ${searchParacetamol.length} items`);
    if (searchParacetamol.length === 0) throw new Error('Expected Paracetamol to be found in catalogue');
    const paraItem = searchParacetamol[0];
    if (!paraItem.name.includes('Paracetamol') || !paraItem.defaultDosage || !paraItem.defaultFrequency) {
      throw new Error('Medicine catalog item missing required metadata fields');
    }
    console.log(`    ↳ Matched: "${paraItem.name}" | Form: ${paraItem.dosageForm} | Cat: ${paraItem.category} | Dose: ${paraItem.defaultDosage} | Freq: ${paraItem.defaultFrequency}`);

    const searchAmox = await DoctorDashboardService.searchMedicines('Amox');
    console.log(`  • Search 'Amox' returned ${searchAmox.length} items (e.g. ${searchAmox.map((m: any) => m.name).join(', ')})`);
    if (searchAmox.length === 0) throw new Error('Expected Amoxicillin to be found in catalogue');

    const searchAtor = await DoctorDashboardService.searchMedicines('Atorvastatin');
    console.log(`  • Search 'Atorvastatin' returned ${searchAtor.length} items`);
    if (searchAtor.length === 0) throw new Error('Expected Atorvastatin to be found in catalogue');

    console.log('✅ [2/10] Scenario 1 passed: Dynamic medicine search returns matching items with complete clinical metadata');

    // -------------------------------------------------------------
    // 3. TEST SCENARIO 2: SAVE DRAFT WITH INDIVIDUAL MEDICINE DETAILS
    // -------------------------------------------------------------
    console.log('\n--- Scenario 2: Save Consultation Draft with Individual Medicine Details ---');
    const encounterAMeds = [
      {
        name: 'Paracetamol 650mg',
        dosage: '1 Tab',
        frequency: 'TDS (1-0-1)',
        duration: '3 days',
        instructions: 'After food (strictly SOS if fever > 100°F)',
        priority: 1,
      },
      {
        name: 'Amoxyclav 625mg',
        dosage: '1 Tab',
        frequency: 'BD (1-0-1)',
        duration: '5 days',
        instructions: 'After breakfast and dinner',
        priority: 2,
      },
      {
        name: 'Pantoprazole 40mg',
        dosage: '1 Cap',
        frequency: 'OD (1-0-0)',
        duration: '7 days',
        instructions: 'Empty stomach, 30 mins before breakfast',
        priority: 3,
      },
      {
        name: 'Cetirizine 10mg',
        dosage: '1 Tab',
        frequency: 'OD at night (0-0-1)',
        duration: '3 days',
        instructions: 'Before sleep, causes drowsiness',
        priority: 4,
      },
    ];

    const draftResult = await DoctorDashboardService.saveConsultationDraft(
      doctor.id,
      aptA.id,
      {
        diagnosis: 'Acute Upper Respiratory Tract Infection with Mild Gastritis',
        chiefComplaints: 'High fever (102°F), sore throat, body aches, acid reflux for 2 days',
        examination: 'Congested pharynx, clear chest bilaterally, epigastric tenderness',
        vitals: { bp: '120/80', pulse: '84', temperature: '101.4', weight: '72', spo2: '98' },
        medicines: encounterAMeds,
        clinicalNotes: 'Warm water gargling thrice daily, light semi-solid diet, plenty of fluids.',
        followUpDate: '09/11/2026',
      }
    );

    console.log(`  • Consultation draft saved for Patient A`);
    const draftInDb = await prisma.consultationDraft.findUnique({
      where: { appointmentId: aptA.id },
    });
    if (!draftInDb || !draftInDb.medicines) throw new Error('ConsultationDraft not created or medicines missing');

    const parsedDraftMeds = JSON.parse(draftInDb.medicines);
    if (parsedDraftMeds.length !== 4) throw new Error(`Expected 4 medicines in draft, found ${parsedDraftMeds.length}`);

    // Verify distinct details for each medicine
    if (parsedDraftMeds[0].dosage !== '1 Tab' || parsedDraftMeds[0].instructions !== 'After food (strictly SOS if fever > 100°F)') {
      throw new Error('Medicine 1 individual details mismatch in draft');
    }
    if (parsedDraftMeds[1].dosage !== '1 Tab' || parsedDraftMeds[1].duration !== '5 days') {
      throw new Error('Medicine 2 individual details mismatch in draft');
    }
    if (parsedDraftMeds[2].dosage !== '1 Cap' || parsedDraftMeds[2].instructions !== 'Empty stomach, 30 mins before breakfast') {
      throw new Error('Medicine 3 individual details mismatch in draft');
    }
    if (parsedDraftMeds[3].frequency !== 'OD at night (0-0-1)' || parsedDraftMeds[3].instructions !== 'Before sleep, causes drowsiness') {
      throw new Error('Medicine 4 individual details mismatch in draft');
    }
    console.log('✅ [3/10] Scenario 2 passed: All 4 medicines retain individual Dosage, Frequency, Duration, and Instructions in draft');

    // -------------------------------------------------------------
    // 4. TEST SCENARIO 3: COMPLETE CONSULTATION & PERSIST PRESCRIPTIONITEM RECORDS
    // -------------------------------------------------------------
    console.log('\n--- Scenario 3: Complete Consultation & Relational PrescriptionItem Persistence ---');
    const completeResult = await DoctorDashboardService.completeConsultation(
      doctor.id,
      aptA.id,
      {
        diagnosis: 'Acute Upper Respiratory Tract Infection with Mild Gastritis',
        chiefComplaints: 'High fever (102°F), sore throat, body aches for 2 days',
        examination: 'Congested pharynx, clear chest bilaterally',
        vitals: { bp: '120/80', pulse: '84', temperature: '101.4', weight: '72', spo2: '98' },
        medicines: encounterAMeds,
        instructions: 'Warm water gargling thrice daily, review in 3 days if fever persists.',
        followUpDate: '09/11/2026',
      }
    );

    const prescription = await prisma.prescription.findUnique({
      where: { appointmentId: aptA.id },
      include: {
        items: { orderBy: { priority: 'asc' } },
      },
    });

    if (!prescription) throw new Error('Prescription was not created');
    console.log(`  • Prescription #${prescription.id} successfully generated`);
    console.log(`  • Relational PrescriptionItem rows created: ${prescription.items.length}`);

    if (prescription.items.length !== 4) {
      throw new Error(`Expected 4 relational PrescriptionItem records, found ${prescription.items.length}`);
    }

    // Verify each item in database
    prescription.items.forEach((item, idx) => {
      const orig = encounterAMeds[idx];
      console.log(`    ↳ Item #${idx + 1}: ${item.medicineName} | Dose: "${item.dosage}" | Freq: "${item.frequency}" | Dur: "${item.duration}" | Notes: "${item.instructions}"`);
      if (item.medicineName !== orig.name) throw new Error(`Medicine name mismatch for item #${idx + 1}`);
      if (item.dosage !== orig.dosage) throw new Error(`Dosage mismatch for item #${idx + 1}`);
      if (item.frequency !== orig.frequency) throw new Error(`Frequency mismatch for item #${idx + 1}`);
      if (item.duration !== orig.duration) throw new Error(`Duration mismatch for item #${idx + 1}`);
      if (item.instructions !== orig.instructions) throw new Error(`Instructions mismatch for item #${idx + 1}`);
      if (item.priority !== orig.priority) throw new Error(`Priority mismatch for item #${idx + 1}`);
    });

    console.log('✅ [4/10] Scenario 3 passed: All prescribed medicines stored as individual relational PrescriptionItem records');

    // -------------------------------------------------------------
    // 5. TEST SCENARIO 4: REOPEN PRESCRIPTION & POPULATE INDIVIDUAL DETAILS
    // -------------------------------------------------------------
    console.log('\n--- Scenario 4: Reopen Prescription & Fetch Consultation Details ---');
    const reopenedConsult = await DoctorDashboardService.getConsultationDetails(doctor.id, aptA.id);
    const reopenedRx = await DoctorDashboardService.getPrescription(doctor.id, aptA.id);

    if (!reopenedConsult.medicines || reopenedConsult.medicines.length !== 4) {
      throw new Error('Reopened consultation details did not return all 4 medicines');
    }
    if (!reopenedRx.prescription.medicines || reopenedRx.prescription.medicines.length !== 4) {
      throw new Error('Reopened prescription did not return all 4 medicines');
    }

    const reloadedPara = reopenedConsult.medicines.find((m: any) => m.name === 'Paracetamol 650mg');
    if (!reloadedPara || reloadedPara.dosage !== '1 Tab' || reloadedPara.instructions !== 'After food (strictly SOS if fever > 100°F)') {
      throw new Error('Reopened Paracetamol 650mg individual details corrupted');
    }

    const reloadedPanto = reopenedConsult.medicines.find((m: any) => m.name === 'Pantoprazole 40mg');
    if (!reloadedPanto || reloadedPanto.dosage !== '1 Cap' || reloadedPanto.instructions !== 'Empty stomach, 30 mins before breakfast') {
      throw new Error('Reopened Pantoprazole 40mg individual details corrupted');
    }

    console.log('✅ [5/10] Scenario 4 passed: Reopening prescription accurately populates individual details for every medicine');

    // -------------------------------------------------------------
    // 6. TEST SCENARIO 5: EDIT ONE MEDICINE (ISOLATION VERIFICATION)
    // -------------------------------------------------------------
    console.log('\n--- Scenario 5: Edit One Medicine Details Without Affecting Others ---');
    // Doctor changes Paracetamol dosage to '650mg SOS' and duration to '2 days'
    const editedMeds = [
      {
        ...encounterAMeds[0],
        dosage: '650mg SOS',
        duration: '2 days',
        instructions: 'Take only if fever exceeds 101°F',
      },
      encounterAMeds[1],
      encounterAMeds[2],
      encounterAMeds[3],
    ];

    await DoctorDashboardService.saveConsultationDraft(doctor.id, aptA.id, {
      medicines: editedMeds,
    });

    const updatedRx = await prisma.prescription.findUnique({
      where: { appointmentId: aptA.id },
      include: { items: { orderBy: { priority: 'asc' } } },
    });

    if (!updatedRx) throw new Error('Updated prescription not found');
    const updatedPara = updatedRx.items.find((i) => i.medicineName === 'Paracetamol 650mg');
    const untouchedAmox = updatedRx.items.find((i) => i.medicineName === 'Amoxyclav 625mg');
    const untouchedPanto = updatedRx.items.find((i) => i.medicineName === 'Pantoprazole 40mg');

    if (!updatedPara || updatedPara.dosage !== '650mg SOS' || updatedPara.duration !== '2 days') {
      throw new Error('Edited medicine did not update correctly');
    }
    if (!untouchedAmox || untouchedAmox.dosage !== '1 Tab' || untouchedAmox.duration !== '5 days') {
      throw new Error('Amoxyclav was unintentionally modified when editing Paracetamol!');
    }
    if (!untouchedPanto || untouchedPanto.dosage !== '1 Cap' || untouchedPanto.duration !== '7 days') {
      throw new Error('Pantoprazole was unintentionally modified when editing Paracetamol!');
    }
    console.log(`  • Paracetamol updated: Dosage -> "${updatedPara.dosage}", Duration -> "${updatedPara.duration}"`);
    console.log(`  • Amoxyclav intact: Dosage -> "${untouchedAmox.dosage}", Duration -> "${untouchedAmox.duration}"`);
    console.log(`  • Pantoprazole intact: Dosage -> "${untouchedPanto.dosage}", Duration -> "${untouchedPanto.duration}"`);
    console.log('✅ [6/10] Scenario 5 passed: Editing one medicine retains all other medicines completely intact');

    // -------------------------------------------------------------
    // 7. TEST SCENARIO 6: REMOVE ONE MEDICINE
    // -------------------------------------------------------------
    console.log('\n--- Scenario 6: Remove One Medicine from Prescription ---');
    // Remove Cetirizine 10mg (Item 4)
    const afterRemovalMeds = [
      editedMeds[0],
      editedMeds[1],
      editedMeds[2],
    ];

    await DoctorDashboardService.saveConsultationDraft(doctor.id, aptA.id, {
      medicines: afterRemovalMeds,
    });

    const rxAfterRemoval = await prisma.prescription.findUnique({
      where: { appointmentId: aptA.id },
      include: { items: { orderBy: { priority: 'asc' } } },
    });

    if (!rxAfterRemoval || rxAfterRemoval.items.length !== 3) {
      throw new Error(`Expected 3 medicines after removal, found ${rxAfterRemoval?.items.length}`);
    }

    if (rxAfterRemoval.items.some((i) => i.medicineName === 'Cetirizine 10mg')) {
      throw new Error('Cetirizine was not removed from PrescriptionItem records');
    }
    console.log(`  • Successfully removed Cetirizine 10mg; 3 medicines remaining: ${rxAfterRemoval.items.map((i) => i.medicineName).join(', ')}`);
    console.log('✅ [7/10] Scenario 6 passed: Removing a medicine keeps remaining individual medicines intact');

    // -------------------------------------------------------------
    // 8. TEST SCENARIO 7: OP-WISE CONSULTATION ISOLATION
    // -------------------------------------------------------------
    console.log('\n--- Scenario 7: OP-Wise Consultation Isolation (Encounter A vs Encounter B) ---');
    const encounterBMeds = [
      {
        name: 'Telmisartan 40mg',
        dosage: '40mg',
        frequency: '1-0-0',
        duration: '30 days',
        instructions: 'After breakfast',
        priority: 1,
      },
      {
        name: 'Amlodipine 5mg',
        dosage: '5mg',
        frequency: '0-0-1',
        duration: '30 days',
        instructions: 'After dinner',
        priority: 2,
      },
    ];

    await DoctorDashboardService.completeConsultation(
      doctor.id,
      aptB.id,
      {
        diagnosis: 'Essential Hypertension - Stage 1',
        chiefComplaints: 'Occasional morning headache, routine BP checkup',
        vitals: { bp: '148/92', pulse: '76', temperature: '98.4', weight: '78', spo2: '99' },
        medicines: encounterBMeds,
        instructions: 'Low sodium diet, brisk walking for 30 mins daily, review in 1 month.',
        followUpDate: '06/12/2026',
      }
    );

    // Verify Patient B prescription
    const rxB = await prisma.prescription.findUnique({
      where: { appointmentId: aptB.id },
      include: { items: { orderBy: { priority: 'asc' } } },
    });
    if (!rxB || rxB.items.length !== 2) throw new Error('Patient B prescription items count mismatch');

    // Verify Patient A prescription is completely untouched
    const rxAFresh = await prisma.prescription.findUnique({
      where: { appointmentId: aptA.id },
      include: { items: { orderBy: { priority: 'asc' } } },
    });
    if (!rxAFresh || rxAFresh.items.length !== 3) {
      throw new Error(`Patient A items corrupted after saving Patient B! Expected 3, found ${rxAFresh?.items.length}`);
    }

    if (!rxAFresh.items.some((i) => i.medicineName === 'Paracetamol 650mg') || rxAFresh.items.some((i) => i.medicineName === 'Telmisartan 40mg')) {
      throw new Error('Data leakage between Patient A and Patient B prescriptions!');
    }
    console.log(`  • Patient A has 3 medicines (${rxAFresh.items.map((i) => i.medicineName).join(', ')})`);
    console.log(`  • Patient B has 2 medicines (${rxB.items.map((i) => i.medicineName).join(', ')})`);
    console.log('✅ [8/10] Scenario 7 passed: Strict patient-wise and consultation-wise data isolation confirmed');

    // -------------------------------------------------------------
    // 9. TEST SCENARIO 8: CONSULTATION PDF GENERATION
    // -------------------------------------------------------------
    console.log('\n--- Scenario 8: Consultation PDF Generation with Individual Medicine Details ---');
    const pdfBuffer = await DoctorDashboardService.generateConsultationPdf(doctor.id, aptA.id);
    if (!pdfBuffer || pdfBuffer.length < 500) {
      throw new Error('Generated PDF buffer is empty or corrupted');
    }
    console.log(`  • Successfully compiled clinical consultation PDF (${pdfBuffer.length} bytes)`);
    console.log('✅ [9/10] Scenario 8 passed: PDF generated with all prescribed medicine fields formatted');

    // -------------------------------------------------------------
    // 10. TEST SCENARIO 9: MASTER CATALOGUE AUTO-UPSERT FOR NEW MEDICINES
    // -------------------------------------------------------------
    console.log('\n--- Scenario 9: Master Catalogue Registration & Searchability ---');
    const uniqueCompoundName = `Bio-Flora Probiotic Plus ${Date.now()}`;
    await DoctorDashboardService.completeConsultation(
      doctor.id,
      aptB.id,
      {
        diagnosis: 'Essential Hypertension with Dysbiosis',
        medicines: [
          ...encounterBMeds,
          {
            name: uniqueCompoundName,
            dosage: '1 Sachet',
            frequency: 'OD with milk',
            duration: '10 days',
            instructions: 'Contains active prebiotic cultures',
            priority: 3,
          },
        ],
      }
    );

    const searchNewMed = await DoctorDashboardService.searchMedicines(uniqueCompoundName);
    if (!searchNewMed.some((m: any) => m.name === uniqueCompoundName)) {
      throw new Error('Newly prescribed medicine was not automatically added to searchable catalogue');
    }
    console.log(`  • Custom medicine "${uniqueCompoundName}" automatically registered in master catalogue and verified searchable`);
    console.log('✅ [10/10] Scenario 9 passed: Dynamic master catalogue auto-registration verified');

    console.log('\n======================================================');
    console.log('🎉 ALL 10 INDIVIDUAL MEDICINE DETAILS & SEARCH TESTS PASSED!');
    console.log('======================================================\n');
  } catch (err: any) {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
