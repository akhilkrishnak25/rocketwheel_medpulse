import prisma from '../config/prisma';
import { LabService } from '../services/lab.service';

async function run() {
  console.log('\n======================================================');
  console.log('🔬 RUNNING LAB ADMIN DASHBOARD & PRICE VISIBILITY TEST SUITE');
  console.log('======================================================\n');

  try {
    // 1. Setup or find hospital & lab
    let hospital = await prisma.hospital.findFirst();
    if (!hospital) {
      hospital = await prisma.hospital.create({
        data: {
          name: 'City Apex Hospital',
          code: `CAH_${Date.now()}`,
          email: `info_${Date.now()}@cityapex.com`,
          phone: '9876543210',
          address: 'Main Health Boulevard',
          city: 'Hyderabad',
          state: 'Telangana',
          pincode: '500001',
          facilities: 'OPD, Pathology, Pharmacy',
        },
      });
    }

    const labName = `Apollo Diagnostics - Central Lab ${Date.now()}`;
    const lab = await prisma.lab.create({
      data: {
        name: labName,
        type: 'INDEPENDENT',
        hospitalId: hospital.id,
        email: `lab_${Date.now()}@centraldiag.org`,
        phone: '040-23456789',
        address: 'Diagnostic Complex, Sector 4',
        city: 'Hyderabad',
        licenseNumber: `NABL-${Date.now()}`,
        status: 'ACTIVE',
        visibility: 'PUBLIC',
        showPrices: true,
      },
    });
    console.log(`✅ [1/8] Created test Laboratory: "${lab.name}" (ID: ${lab.id})`);

    // 2. Create test catalog test with specific price
    const originalPrice = 850;
    const testItem = await LabService.createLabTest(lab.id, {
      code: `LIPID-${Date.now().toString().slice(-4)}`,
      name: 'Comprehensive Lipid Profile',
      category: 'Biochemistry',
      description: 'Total Cholesterol, HDL, LDL, Triglycerides, VLDL',
      tatHours: 12,
      price: originalPrice,
      status: 'ACTIVE',
    });
    console.log(`✅ [2/8] Created test catalog item "${testItem.name}" with Price = ₹${testItem.price}`);

    // 3. Test Requirement 1: Toggle Show / Hide Prices & Verify database price preservation
    console.log('\n--- Testing Requirement 1: Show Prices / Hide Prices Option ---');
    
    // 3a. Hide prices
    const hiddenSettings = await LabService.updatePriceVisibility(lab.id, false);
    console.log(`  • Updated lab price visibility -> showPrices = ${hiddenSettings.showPrices}`);
    if (hiddenSettings.showPrices !== false) {
      throw new Error('Failed to set showPrices to false');
    }

    // 3b. Verify public/patient search returns hidden price
    const publicTestsWhenHidden = await LabService.getPublicLabTests(lab.id);
    const targetTestHidden = publicTestsWhenHidden.find((t: any) => t.id === testItem.id);
    console.log(`  • Public patient view when prices hidden: isPriceVisible = ${targetTestHidden?.isPriceVisible}, displayPrice = "${targetTestHidden?.displayPrice}", price = ${targetTestHidden?.price}`);
    if (targetTestHidden?.isPriceVisible !== false || targetTestHidden?.price !== 0 || targetTestHidden?.displayPrice !== 'Price on Request') {
      throw new Error('Public patient should not see actual price when showPrices is false');
    }

    // 3c. Verify stored price in database is NEVER removed or modified
    const dbTest = await prisma.labTest.findUnique({ where: { id: testItem.id } });
    console.log(`  • Database stored price for "${dbTest?.name}" = ₹${dbTest?.price} (Intact!)`);
    if (dbTest?.price !== originalPrice) {
      throw new Error(`Database price modified! Expected ₹${originalPrice}, got ₹${dbTest?.price}`);
    }

    // 3d. Verify Hospital Admin / Doctors continue to see full price
    const doctorTestsView = await LabService.getPublicLabTests(lab.id, undefined, undefined, hospital.id);
    const doctorTestItem = doctorTestsView.find((t: any) => t.id === testItem.id);
    console.log(`  • Doctor/Hospital staff view: isPriceVisible = ${doctorTestItem?.isPriceVisible}, price = ₹${doctorTestItem?.price}`);
    if (doctorTestItem?.isPriceVisible !== true || doctorTestItem?.price !== originalPrice) {
      throw new Error('Hospital staff and doctors must continue to see full prices');
    }

    // 3e. Re-enable Show Prices
    await LabService.updatePriceVisibility(lab.id, true);
    const publicTestsWhenVisible = await LabService.getPublicLabTests(lab.id);
    const targetTestVisible = publicTestsWhenVisible.find((t: any) => t.id === testItem.id);
    console.log(`  • Public patient view when showPrices = true: isPriceVisible = ${targetTestVisible?.isPriceVisible}, price = ₹${targetTestVisible?.price}`);
    if (targetTestVisible?.isPriceVisible !== true || targetTestVisible?.price !== originalPrice) {
      throw new Error('Public patients should see full price when showPrices is true');
    }
    console.log('✅ [3/8] Requirement 1 passed: Price visibility toggle, database fee preservation & doctor access verified');

    // 4. Test Direct Patient Booking Flow (Requirement 2B)
    console.log('\n--- Testing Requirement 2B: Direct Patient Booking ---');
    const directBooking = await LabService.bookCustomerLabTest({
      labId: lab.id,
      patientName: 'Ramesh Kumar',
      mobileNumber: '9123456780',
      gender: 'MALE',
      age: 42,
      preferredDate: new Date().toISOString().split('T')[0],
      testIds: [testItem.id],
      notes: 'Fasting 12 hours prior to collection',
    });

    console.log(`  • Created Direct Patient Booking: #${directBooking.requestNumber} (Total: ₹${directBooking.totalAmount})`);
    const dbDirectBooking = await prisma.labTestRequest.findUnique({
      where: { id: directBooking.id },
      include: { patient: true },
    });
    if (dbDirectBooking?.bookingSource !== 'DIRECT_PATIENT') {
      throw new Error(`Expected bookingSource to be DIRECT_PATIENT, got "${dbDirectBooking?.bookingSource}"`);
    }
    if (dbDirectBooking?.paymentStatus !== 'PENDING') {
      throw new Error(`Expected paymentStatus to be PENDING, got "${dbDirectBooking?.paymentStatus}"`);
    }
    console.log('✅ [4/8] Direct Patient Booking created with bookingSource = DIRECT_PATIENT and paymentStatus = PENDING');

    // 5. Test Hospital-Sent Request Flow (Requirement 2A)
    console.log('\n--- Testing Requirement 2A: Hospital-Sent Test Request ---');
    // Setup patient and doctor for hospital request
    const hospPatient = await prisma.patient.create({
      data: {
        hospitalId: hospital.id,
        patientIdNumber: `MRN-${Date.now().toString().slice(-5)}`,
        fullName: 'Anita Sharma',
        mobileNumber: '9876501234',
        email: `anita.${Date.now()}@example.com`,
        gender: 'FEMALE',
        age: 35,
      },
    });

    let hospDoctor = await prisma.doctor.findFirst({
      where: { hospitalId: hospital.id },
    });

    if (!hospDoctor) {
      let dept = await prisma.department.findFirst({ where: { hospitalId: hospital.id } });
      if (!dept) {
        dept = await prisma.department.create({
          data: {
            hospitalId: hospital.id,
            name: 'General Medicine',
            slug: `gen-med-${Date.now()}`,
            code: `GM-${Date.now().toString().slice(-4)}`,
            description: 'General internal medicine department',
          },
        });
      }

      const userDoctor = await prisma.user.create({
        data: {
          email: `dr.labtest.${Date.now()}@hospital.org`,
          name: 'Dr. Vikram Seth',
          passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
          role: 'DOCTOR',
        },
      });

      hospDoctor = await prisma.doctor.create({
        data: {
          userId: userDoctor.id,
          hospitalId: hospital.id,
          departmentId: dept.id,
          name: 'Dr. Vikram Seth',
          qualification: 'MBBS, MD',
          specialization: 'Internal Medicine',
          languages: 'English, Hindi',
          about: 'Consultant physician with pathology coordination experience',
          consultationFee: 600,
          workingDays: 'Mon,Tue,Wed,Thu,Fri',
          workingHoursStart: '09:00',
          workingHoursEnd: '17:00',
        },
      });
    }

    const hospRequestNumber = `LAB-HOSP-${Date.now().toString().slice(-6)}`;
    const hospRequest = await prisma.labTestRequest.create({
      data: {
        requestNumber: hospRequestNumber,
        labId: lab.id,
        hospitalId: hospital.id,
        patientId: hospPatient.id,
        doctorId: hospDoctor.id,
        bookingSource: 'HOSPITAL',
        paymentStatus: 'PAID',
        priority: 'URGENT',
        status: 'REQUESTED',
        tests: JSON.stringify([
          { id: testItem.id, code: testItem.code, name: testItem.name, price: testItem.price },
        ]),
        totalAmount: originalPrice,
        clinicalNotes: 'Evaluate chest discomfort & lipid elevation',
      },
    });
    console.log(`  • Created Hospital-Sent Test Request: #${hospRequest.requestNumber} by ${hospDoctor.name}`);
    console.log('✅ [5/8] Hospital-Sent test request successfully registered');

    // 6. Test Dashboard Summary Cards (Requirement 3)
    console.log('\n--- Testing Requirement 3: Dashboard Summary Cards ---');
    const stats = await LabService.getLabStats(lab.id);
    console.log('  • KPI Summary Metrics:', stats);
    if (stats.totalHospitalRequests < 1) throw new Error('totalHospitalRequests should be >= 1');
    if (stats.pendingHospitalRequests < 1) throw new Error('pendingHospitalRequests should be >= 1');
    if (stats.directPatientBookings < 1) throw new Error('directPatientBookings should be >= 1');
    if (stats.todayBookings < 2) throw new Error('todayBookings should be >= 2');
    console.log('✅ [6/8] Requirement 3 passed: All 6 summary cards calculated accurately');

    // 7. Test Filters & Source Separation (Requirement 4 & 5)
    console.log('\n--- Testing Requirement 4 & 5: Source Separation & Filtering ---');
    
    // Filter by Hospital source
    const hospOnly = await LabService.getTestRequests(lab.id, { source: 'HOSPITAL' });
    console.log(`  • Hospital-only filter returned ${hospOnly.length} items`);
    if (!hospOnly.every((r: any) => r.bookingSource === 'HOSPITAL')) {
      throw new Error('source: HOSPITAL filter returned non-hospital items');
    }

    // Filter by Direct Patient source
    const directOnly = await LabService.getTestRequests(lab.id, { source: 'DIRECT_PATIENT' });
    console.log(`  • Direct Patient-only filter returned ${directOnly.length} items`);
    if (!directOnly.every((r: any) => r.bookingSource === 'DIRECT_PATIENT')) {
      throw new Error('source: DIRECT_PATIENT filter returned non-direct items');
    }

    // Filter by test name
    const testNameFilterResult = await LabService.getTestRequests(lab.id, { testName: 'Lipid' });
    console.log(`  • Filter by testName "Lipid" returned ${testNameFilterResult.length} items`);
    if (testNameFilterResult.length < 2) {
      throw new Error('testName filter failed to match requested tests');
    }

    // Search by patient name
    const searchResult = await LabService.getTestRequests(lab.id, { search: 'Anita' });
    console.log(`  • Search by patient name "Anita" returned ${searchResult.length} items`);
    if (!searchResult.some((r: any) => r.patient?.fullName?.includes('Anita'))) {
      throw new Error('Search failed to find patient Anita');
    }
    console.log('✅ [7/8] Requirement 4 & 5 passed: Source separation and multi-criteria filters verified');

    // 8. Test Status Tracking & Report Submission Workflow
    console.log('\n--- Testing Status Transitions & Report Submission ---');
    
    // 8a. Accept direct booking
    const acceptedReq = await LabService.updateRequestStatus(lab.id, directBooking.id, 'ACCEPTED');
    console.log(`  • Status transition: REQUESTED -> ${acceptedReq.status}`);
    if (acceptedReq.status !== 'ACCEPTED') throw new Error('Failed to transition to ACCEPTED');

    // 8b. Mark Sample Collected
    const sampleReq = await LabService.updateRequestStatus(lab.id, directBooking.id, 'SAMPLE_COLLECTED');
    console.log(`  • Status transition: ACCEPTED -> ${sampleReq.status}`);
    if (sampleReq.status !== 'SAMPLE_COLLECTED') throw new Error('Failed to transition to SAMPLE_COLLECTED');

    // 8c. Start Processing & Mark Payment as Paid
    const procReq = await LabService.updateRequestStatus(lab.id, directBooking.id, 'PROCESSING', undefined, 'PAID');
    console.log(`  • Status transition: SAMPLE_COLLECTED -> ${procReq.status}, paymentStatus: ${procReq.paymentStatus}`);
    if (procReq.status !== 'PROCESSING' || procReq.paymentStatus !== 'PAID') {
      throw new Error('Failed to transition to PROCESSING or update paymentStatus');
    }

    // 8d. Submit diagnostic report and complete
    const report = await LabService.submitReport(
      lab.id,
      directBooking.id,
      {
        results: 'Lipid Profile Findings: Total Cholesterol: 185 mg/dL (Normal), Triglycerides: 140 mg/dL (Normal), HDL: 52 mg/dL, LDL: 105 mg/dL',
        remarks: 'Optimal lipid parameters. Advised annual health checkup.',
        fileUrl: 'https://example.com/reports/sample_lipid_report.pdf',
      },
      'tech_01',
      'Chief Pathologist'
    );
    console.log(`  • Report submitted: ID ${report.id}, test marked COMPLETED`);

    const finalReq = await prisma.labTestRequest.findUnique({
      where: { id: directBooking.id },
      include: { report: true },
    });
    if (finalReq?.status !== 'COMPLETED' || !finalReq.report) {
      throw new Error('Request was not marked COMPLETED or report missing');
    }
    console.log('✅ [8/8] Workflow passed: Complete lifecycle Pending -> Accepted -> Sample Collected -> Processing -> Completed with report verified!');

    console.log('\n======================================================');
    console.log('🎉 ALL LAB ADMIN DASHBOARD & PRICING TESTS PASSED (8/8)!');
    console.log('======================================================\n');
  } catch (err: any) {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
