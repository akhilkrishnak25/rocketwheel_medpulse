const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { AppointmentService } = require('./dist/services/appointment.service');
const { DoctorDashboardService } = require('./dist/services/doctorDashboard.service');
const { LabService } = require('./dist/services/lab.service');
const { humanizeErrorMessage } = require('./dist/utils/response');

async function runAllTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING END-TO-END VALIDATION FOR ALL 17 FEATURES');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // ----------------------------------------------------
    // TEST 1 & 6: MONOTONIC OPD TOKEN NUMBERING & VITALS FETCH
    // ----------------------------------------------------
    console.log('--- Test Suite 1: OPD Monotonic Token Numbering (Req 6) ---');
    const doctor = await prisma.doctor.findFirst({
      where: { isActive: true },
      include: { hospital: true },
    });
    if (!doctor) throw new Error('No active doctor found for test');

    const testDate = '2026-10-15';
    // Clean any prior appointments on test date
    await prisma.appointment.deleteMany({
      where: { doctorId: doctor.id, appointmentDate: testDate },
    });

    const apt1Res = await AppointmentService.createOfflineAppointment({
      hospitalId: doctor.hospitalId,
      doctorId: doctor.id,
      appointmentDate: testDate,
      timeSlot: '10:00 AM',
      patient: {
        fullName: 'Test Patient Token 1',
        mobileNumber: '9900112233',
        gender: 'MALE',
      },
    });
    const apt1 = apt1Res.appointment;

    const apt2Res = await AppointmentService.createOfflineAppointment({
      hospitalId: doctor.hospitalId,
      doctorId: doctor.id,
      appointmentDate: testDate,
      timeSlot: '10:15 AM',
      patient: {
        fullName: 'Test Patient Token 2',
        mobileNumber: '9900112234',
        gender: 'FEMALE',
      },
    });
    const apt2 = apt2Res.appointment;

    assert(apt1.tokenNumber === 1, `Appointment 1 received Token #1 (Got: ${apt1.tokenNumber})`);
    assert(apt2.tokenNumber === 2, `Appointment 2 received Token #2 (Got: ${apt2.tokenNumber})`);

    // Cancel appointment 1 to verify token 3 is still strictly increasing
    await prisma.appointment.update({
      where: { id: apt1.id },
      data: { status: 'CANCELLED' },
    });

    const apt3Res = await AppointmentService.createOfflineAppointment({
      hospitalId: doctor.hospitalId,
      doctorId: doctor.id,
      appointmentDate: testDate,
      timeSlot: '10:30 AM',
      patient: {
        fullName: 'Test Patient Token 3',
        mobileNumber: '9900112235',
        gender: 'OTHER',
      },
    });
    const apt3 = apt3Res.appointment;

    assert(
      apt3.tokenNumber === 3,
      `Appointment 3 received Token #3 after Apt 1 cancellation (Monotonic guarantee preserved! Got: ${apt3.tokenNumber})`
    );

    // ----------------------------------------------------
    // TEST 2: VITALS -> DOCTOR CONSULTATION AUTO-FETCH (Req 1)
    // ----------------------------------------------------
    console.log('\n--- Test Suite 2: Vitals -> Doctor Consultation (Req 1) ---');
    // Record screening vitals for apt2's patient
    const recordedVital = await prisma.patientVital.create({
      data: {
        patientId: apt2.patientId,
        appointmentId: apt2.id,
        hospitalId: doctor.hospitalId,
        bloodPressure: '130/85 mmHg',
        bpSystolic: 130,
        bpDiastolic: 85,
        pulseRate: 78,
        temperature: 98.6,
        weight: 68,
        spo2: 98,
        notes: 'Pre-screened by nurse. Patient in mild discomfort.',
      },
    });

    const consultData = await DoctorDashboardService.getConsultationDetails(doctor.id, apt2.id);
    assert(
      consultData.vitals !== null && consultData.vitals.bloodPressure === '130/85 mmHg',
      'Doctor Consultation API auto-fetches nurse recorded vitals correctly'
    );
    assert(
      consultData.currentVitals !== null && consultData.currentVitals.pulseRate === 78,
      'Doctor Consultation API exposes currentVitals alias matching frontend interface'
    );
    assert(
      consultData.patient !== null && consultData.patient.fullName === 'Test Patient Token 2',
      'Doctor Consultation API exposes top-level patient record'
    );

    // Complete consultation using auto-fetched vitals
    const completedConsult = await DoctorDashboardService.completeConsultation(
      doctor.id,
      apt2.id,
      {
        diagnosis: 'Acute Bronchitis',
        medicines: [{ name: 'Tab Azithromycin 500mg', dosage: '1 Tab', frequency: '1-0-0', duration: '3 days' }],
        vitals: { bp: consultData.vitals.bloodPressure, pulse: `${consultData.vitals.pulseRate} bpm` },
        clinicalNotes: 'Rest and follow up after 3 days.',
      }
    );
    assert(
      completedConsult.prescription.diagnosis === 'Acute Bronchitis',
      'Doctor successfully completed consultation with pre-screened vitals without forced re-entry'
    );

    // ----------------------------------------------------
    // TEST 3: PRESCRIPTION TEMPLATE MANAGEMENT (CRUD, SEARCH, BULK) (Req 2)
    // ----------------------------------------------------
    console.log('\n--- Test Suite 3: Prescription Template Management (Req 2) ---');
    // Clean old test templates
    await prisma.prescriptionTemplate.deleteMany({ where: { doctorId: doctor.id } });

    // 1. Create
    const tmpl1 = await DoctorDashboardService.createPrescriptionTemplate(doctor.id, {
      diseaseName: 'Viral Rhinitis',
      diagnosis: 'Acute Upper Respiratory Catarrh',
      medicines: [{ name: 'Tab Levocetirizine 5mg', dosage: '1 Tab', frequency: '0-0-1', duration: '5 days' }],
      instructions: 'Steam inhalation twice daily',
    });
    assert(tmpl1.diseaseName === 'Viral Rhinitis', 'Single template created successfully');

    // 2. Search
    const searchRes = await DoctorDashboardService.getPrescriptionTemplates(doctor.id, 'Viral');
    assert(
      searchRes.length === 1 && searchRes[0].diseaseName === 'Viral Rhinitis',
      'Search template by query returns matching disease'
    );

    // 3. Update
    const updatedTmpl = await DoctorDashboardService.updatePrescriptionTemplate(doctor.id, tmpl1.id, {
      diseaseName: 'Viral Rhinitis (Updated)',
      instructions: 'Steam inhalation thrice daily',
    });
    assert(
      updatedTmpl.diseaseName === 'Viral Rhinitis (Updated)' && updatedTmpl.instructions === 'Steam inhalation thrice daily',
      'Template updated successfully (disease name and advice)'
    );

    // 4. Bulk Upload
    const bulkData = [
      {
        diseaseName: 'Type 2 Diabetes Mellitus',
        diagnosis: 'Uncomplicated T2DM',
        medicines: 'Tab Metformin 500mg:1 Tab:1-0-1:30 days;Tab Glimepiride 1mg:1 Tab:1-0-0:30 days',
        instructions: 'Low glycemic diet and daily 30-min walk',
      },
      {
        diseaseName: 'Peptic Ulcer Disease',
        diagnosis: 'Gastric Hyperacidity / GERD',
        medicines: [{ name: 'Cap Pantoprazole 40mg', dosage: '1 Cap', frequency: '1-0-0', duration: '14 days' }],
        instructions: 'Avoid acidic foods',
      },
    ];
    const bulkRes = await DoctorDashboardService.bulkCreatePrescriptionTemplates(doctor.id, bulkData);
    assert(bulkRes.count === 2, `Bulk uploaded ${bulkRes.count} prescription templates successfully`);

    // 5. Delete
    await DoctorDashboardService.deletePrescriptionTemplate(doctor.id, tmpl1.id);
    const remaining = await DoctorDashboardService.getPrescriptionTemplates(doctor.id);
    assert(remaining.length === 2, 'Template deleted successfully');

    // ----------------------------------------------------
    // TEST 4 & 5: LAB SELECTION & MULTI-TEST ORDERING (Req 4 & 5)
    // ----------------------------------------------------
    console.log('\n--- Test Suite 4: Consultation Lab Selection & Multi-Test Ordering (Req 4 & 5) ---');
    const approvedLabs = await LabService.getActiveLabs();
    assert(approvedLabs.length > 0, `Active accredited laboratories found (${approvedLabs.length} labs)`);

    const selectedLab = approvedLabs[0];
    const labCatalogTests = await LabService.getLabTests(selectedLab.id);
    assert(labCatalogTests.length >= 2, `Lab catalog has live tests (${labCatalogTests.length} tests)`);

    const chosenTests = [
      { name: labCatalogTests[0].name, code: labCatalogTests[0].code, price: labCatalogTests[0].price },
      { name: labCatalogTests[1].name, code: labCatalogTests[1].code, price: labCatalogTests[1].price },
    ];
    const expectedTotal = chosenTests[0].price + chosenTests[1].price;

    const doctorLabReq = await DoctorDashboardService.createLabTestRequest(doctor.id, {
      appointmentId: apt3.id,
      patientId: apt3.patientId,
      labId: selectedLab.id,
      tests: chosenTests,
      clinicalNotes: 'Suspected systemic infection',
      priority: 'URGENT',
    });

    assert(
      doctorLabReq.labId === selectedLab.id,
      `Requisition scoped to doctor-selected approved lab: ${selectedLab.name}`
    );
    assert(
      JSON.parse(doctorLabReq.tests).length === 2,
      'Multiple lab tests ordered in one requisition (Req 5)'
    );
    assert(
      doctorLabReq.totalAmount === expectedTotal,
      `Live DB pricing totaled accurately: ₹${doctorLabReq.totalAmount} (Expected: ₹${expectedTotal})`
    );

    // ----------------------------------------------------
    // TEST 7 & 12: LAB TECHNICIAN TEST & PRICE CRUD (Req 7 & 12)
    // ----------------------------------------------------
    console.log('\n--- Test Suite 5: Lab Technician Test & Price CRUD (Req 7 & 12) ---');
    const newTestCode = `TEST-${Date.now().toString(36).toUpperCase()}`;
    const createdTest = await LabService.createLabTest(selectedLab.id, {
      name: 'Custom Serology Panel',
      code: newTestCode,
      category: 'Serology',
      description: 'Screens for antibodies',
      tatHours: 12,
      price: 850,
    });
    assert(createdTest.price === 850 && createdTest.name === 'Custom Serology Panel', 'Technician created new diagnostic test with price');

    const updatedTest = await LabService.updateLabTest(selectedLab.id, createdTest.id, {
      price: 950,
      description: 'Updated antibody screening protocol',
    });
    assert(updatedTest.price === 950, `Technician updated test price to ₹${updatedTest.price}`);

    const toggled = await LabService.toggleLabTestStatus(selectedLab.id, createdTest.id);
    assert(toggled.status === 'INACTIVE', 'Technician toggled test status to INACTIVE');

    await LabService.deleteLabTest(selectedLab.id, createdTest.id);
    const testCheck = await prisma.labTest.findUnique({ where: { id: createdTest.id } });
    assert(testCheck === null, 'Technician deleted test from catalog successfully');

    // ----------------------------------------------------
    // TEST 8 & 9: CUSTOMER LAB TEST BOOKING FLOW (Req 8 & 9)
    // ----------------------------------------------------
    console.log('\n--- Test Suite 6: Customer Lab Test Booking Flow (Req 8 & 9) ---');
    const publicTests = await LabService.getPublicLabTests(selectedLab.id);
    assert(publicTests.length > 0, `Public test catalog search functional (${publicTests.length} tests available)`);

    const customerBooking = await LabService.bookCustomerLabTest({
      labId: selectedLab.id,
      patientName: 'Ananya Sharma',
      mobileNumber: '9888877777',
      email: 'ananya@example.com',
      gender: 'FEMALE',
      age: 29,
      preferredDate: '2026-10-20',
      testIds: [publicTests[0].id, publicTests[1].id],
      notes: 'Please arrange fasting collection morning',
    });

    assert(
      customerBooking.success === true && customerBooking.requestNumber.startsWith('LAB-'),
      `Customer direct booking created with requisition #${customerBooking.requestNumber}`
    );
    assert(
      customerBooking.tests.length === 2,
      'Customer multi-test booking registered'
    );

    // Track status
    const tracking = await LabService.getBookingStatus(customerBooking.requestNumber);
    assert(tracking.status === 'REQUESTED', `Tracking API reports status: ${tracking.status}`);

    // ----------------------------------------------------
    // TEST 10 & 11: LAB STATUS UPDATE FIX & STATUS AUDIT (Req 10 & 11)
    // ----------------------------------------------------
    console.log('\n--- Test Suite 7: Lab Technician Status Transitions (Req 10 & 11) ---');
    // 1. Approve & Receive (ACCEPTED)
    const acceptedReq = await LabService.updateRequestStatus(selectedLab.id, customerBooking.id, 'ACCEPTED');
    assert(acceptedReq.status === 'ACCEPTED', 'Technician approved requisition -> ACCEPTED');

    // 2. Start Testing (PROCESSING)
    const processingReq = await LabService.updateRequestStatus(selectedLab.id, customerBooking.id, 'PROCESSING');
    assert(processingReq.status === 'PROCESSING', 'Technician started testing -> PROCESSING');

    // 3. Submit Report (COMPLETED)
    const report = await LabService.submitReport(
      selectedLab.id,
      customerBooking.id,
      {
        results: 'All parameters within normal biological reference intervals.',
        remarks: 'Satisfactory health indicators.',
      },
      'tech_user_1',
      'Dr. Robert Pathologist'
    );
    assert(report.results.includes('within normal biological reference'), 'Diagnostic report submitted');

    const finalReq = await prisma.labTestRequest.findUnique({ where: { id: customerBooking.id } });
    assert(finalReq.status === 'COMPLETED', 'Requisition finalized to COMPLETED');

    // 4. Test Rejection flow on another requisition
    const rejectReq = await LabService.updateRequestStatus(selectedLab.id, doctorLabReq.id, 'CANCELLED');
    assert(rejectReq.status === 'CANCELLED', 'Technician rejected/cancelled requisition -> CANCELLED');

    // ----------------------------------------------------
    // TEST 3: HUMANIZED ERROR HANDLING (Req 3)
    // ----------------------------------------------------
    console.log('\n--- Test Suite 8: User-Friendly Error Humanization (Req 3) ---');
    const rawZodError = JSON.stringify([
      { code: 'invalid_type', expected: 'string', received: 'undefined', path: ['patientName'], message: 'Required' },
      { code: 'invalid_enum_value', path: ['priority'], message: 'Invalid enum' },
    ]);
    const humanizedZod = humanizeErrorMessage(rawZodError);
    assert(
      !humanizedZod.includes('[') && humanizedZod.includes('Patient Name is required') && humanizedZod.toLowerCase().includes('priority'),
      `Zod JSON error humanized nicely: "${humanizedZod}"`
    );

    const rawPrismaUnique = {
      code: 'P2002',
      meta: { target: ['email'] },
      message: 'Unique constraint failed on the fields: (`email`)',
    };
    const humanizedPrisma = humanizeErrorMessage(rawPrismaUnique);
    assert(
      humanizedPrisma.includes('already exists'),
      `Prisma P2002 humanized nicely: "${humanizedPrisma}"`
    );

    // ----------------------------------------------------
    // SUMMARY
    // ----------------------------------------------------
    console.log('\n====================================================');
    console.log(`🎉 ALL TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during test execution:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAllTests();
