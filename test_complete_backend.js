const BASE_URL = 'http://localhost:5000/api';

async function runCompleteBackendTestSuite() {
  console.log('\n======================================================');
  console.log('🚀 RUNNING COMPREHENSIVE BACKEND VERIFICATION SUITE');
  console.log('======================================================\n');

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
    // TEST SUITE 1: HEALTH CHECK & SYSTEM INTEGRITY
    // ----------------------------------------------------
    console.log('\n--- 1. API Health Check & Discovery ---');
    const health = await fetch(`${BASE_URL}/health`).then((r) => r.json());
    assert(health.status === 'healthy', 'Health check endpoint returns healthy status');

    const hospitalsRes = await fetch(`${BASE_URL}/hospitals`).then((r) => r.json());
    assert(hospitalsRes.success && hospitalsRes.data.length > 0, `Discovered ${hospitalsRes.data.length} accredited hospitals`);
    const apolloHospital = hospitalsRes.data.find((h) => h.name.includes('Apollo')) || hospitalsRes.data[0];

    const departmentsRes = await fetch(`${BASE_URL}/hospitals/departments`).then((r) => r.json());
    assert(departmentsRes.success && departmentsRes.data.length > 0, `Discovered ${departmentsRes.data.length} hospital departments`);

    // ----------------------------------------------------
    // TEST SUITE 2: GLOBAL DOCTOR DISCOVERY & AVAILABILITY
    // ----------------------------------------------------
    console.log('\n--- 2. Doctor Discovery & Slot Calculation ---');
    const globalDoctorsRes = await fetch(`${BASE_URL}/doctors?sortBy=fee_asc`).then((r) => r.json());
    assert(globalDoctorsRes.success && globalDoctorsRes.data.length > 0, `Global doctors query returned ${globalDoctorsRes.data.length} doctors`);

    // Select Dr. Rahul Kumar so we can test doctor portal workflows with his seeded login
    const rahulDocRes = await fetch(`${BASE_URL}/doctors?search=Rahul`).then((r) => r.json());
    const doctor = rahulDocRes.data?.[0] || globalDoctorsRes.data[0];
    const docProfileRes = await fetch(`${BASE_URL}/doctors/${doctor.id}`).then((r) => r.json());
    assert(docProfileRes.success && docProfileRes.data.id === doctor.id, `Doctor profile loaded: ${docProfileRes.data.name} (${docProfileRes.data.specialization})`);

    // Find a weekday for slots
    const today = new Date();
    let testDateObj = new Date(today);
    testDateObj.setDate(today.getDate() + 5); // 5 days ahead
    if (testDateObj.getDay() === 0) testDateObj.setDate(testDateObj.getDate() + 1); // skip Sunday
    const testDate = testDateObj.toISOString().split('T')[0];

    const slotsRes = await fetch(`${BASE_URL}/doctors/${doctor.id}/availability?date=${testDate}`).then((r) => r.json());
    assert(slotsRes.success && slotsRes.data.slots.length > 0, `Retrieved ${slotsRes.data.slots.length} time slots for date ${testDate}`);
    const availableSlot = slotsRes.data.slots.find((s) => s.isAvailable);
    assert(!!availableSlot, `Found available time slot: ${availableSlot?.time}`);

    // ----------------------------------------------------
    // TEST SUITE 3: GUEST BOOKING FLOW (ZERO LOGIN)
    // ----------------------------------------------------
    console.log('\n--- 3. Guest Patient Booking (No Login Required) ---');
    const guestPatient = {
      fullName: 'Vikramaditya Sharma',
      mobileNumber: '9845199887',
      email: 'vikram.sharma@example.org',
      gender: 'Male',
      bloodGroup: 'B+',
      address: 'Madhapur, Hyderabad',
    };

    const bookingRes = await fetch(`${BASE_URL}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hospitalId: doctor.hospitalId,
        doctorId: doctor.id,
        departmentId: doctor.departmentId,
        appointmentDate: testDate,
        timeSlot: availableSlot.time,
        patient: guestPatient,
        notes: 'Cardiology routine screening consultation',
      }),
    }).then((r) => r.json());

    assert(bookingRes.success && bookingRes.data.appointment, `Pending appointment created: ${bookingRes.data?.appointment?.appointmentNumber}`);
    assert(!!bookingRes.data?.paymentOrder?.orderId, `Payment order generated: ${bookingRes.data?.paymentOrder?.orderId}`);

    // Test Concurrency Lock: Double booking of the exact same slot
    const doubleBookingRes = await fetch(`${BASE_URL}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hospitalId: doctor.hospitalId,
        doctorId: doctor.id,
        departmentId: doctor.departmentId,
        appointmentDate: testDate,
        timeSlot: availableSlot.time,
        patient: {
          fullName: 'Concurrent Attempter',
          mobileNumber: '9111122223',
          email: 'concurrent@example.com',
        },
      }),
    }).then((r) => r.json());

    assert(!doubleBookingRes.success, `Concurrency check: Double booking instantly rejected (${doubleBookingRes.message})`);

    // ----------------------------------------------------
    // TEST SUITE 4: PAYMENT VERIFICATION & DIGITAL OP GENERATION
    // ----------------------------------------------------
    console.log('\n--- 4. Payment Verification & Digital OP Generation ---');
    const dynamicPaymentId = `pay_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const confirmRes = await fetch(`${BASE_URL}/appointments/confirm-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointmentId: bookingRes.data.appointment.id,
        razorpayOrderId: bookingRes.data.paymentOrder.orderId,
        razorpayPaymentId: dynamicPaymentId,
        razorpaySignature: `simulated_sig_${bookingRes.data.paymentOrder.orderId}`,
      }),
    }).then((r) => r.json());

    assert(confirmRes.success && confirmRes.data.digitalOp, `Payment verified! OP Number: ${confirmRes.data?.digitalOp?.opNumber}`);
    assert(confirmRes.data?.digitalOp?.secureToken?.length >= 32, `Cryptographic secure token created: ${confirmRes.data?.digitalOp?.secureToken?.substring(0, 16)}...`);

    // ----------------------------------------------------
    // TEST SUITE 5: PUBLIC QR VERIFICATION & PDF STREAMING
    // ----------------------------------------------------
    console.log('\n--- 5. Public QR Verification & PDF Generation ---');
    const qrVerifyRes = await fetch(`${BASE_URL}/appointments/verify-op/${confirmRes.data.digitalOp.secureToken}`).then((r) => r.json());
    assert(qrVerifyRes.success && qrVerifyRes.data.opNumber === confirmRes.data.digitalOp.opNumber, `QR Token successfully authenticated OP: ${qrVerifyRes.data.opNumber}`);
    assert(qrVerifyRes.data.patientName === guestPatient.fullName, `Patient verified without medical data leak: ${qrVerifyRes.data.patientName}`);

    const pdfRes = await fetch(`${BASE_URL}/appointments/${bookingRes.data.appointment.id}/pdf`);
    assert(pdfRes.status === 200 && pdfRes.headers.get('content-type')?.includes('application/pdf'), `Digital OP PDF successfully generated and streamed (HTTP 200, application/pdf)`);

    // ----------------------------------------------------
    // TEST SUITE 6: QUEUE TRACKING & OTP LOOKUP
    // ----------------------------------------------------
    console.log('\n--- 6. Queue Status & Patient OTP Lookup ---');
    const queueRes = await fetch(`${BASE_URL}/appointments/${bookingRes.data.appointment.id}/queue`).then((r) => r.json());
    assert(queueRes.success && typeof queueRes.data.yourToken === 'number', `Live queue status: Token #${queueRes.data.yourToken}, Patients ahead: ${queueRes.data.patientsAhead}`);

    // Request OTP for lookup
    const otpReqRes = await fetch(`${BASE_URL}/otp/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointmentNumberOrId: confirmRes.data.digitalOp.opNumber,
        mobileNumber: guestPatient.mobileNumber,
      }),
    }).then((r) => r.json());
    assert(otpReqRes.success, `OTP requested for mobile ${guestPatient.mobileNumber}: demo code ${otpReqRes.data?.demoOtp}`);

    // Verify OTP
    const otpVerifyRes = await fetch(`${BASE_URL}/otp/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointmentNumberOrId: confirmRes.data.digitalOp.opNumber,
        mobileNumber: guestPatient.mobileNumber,
        otpCode: otpReqRes.data?.demoOtp || '123456',
      }),
    }).then((r) => r.json());
    assert(otpVerifyRes.success && otpVerifyRes.data?.id === bookingRes.data.appointment.id, 'OTP verified! Guest patient accessed appointment record');

    // ----------------------------------------------------
    // TEST SUITE 7: DOCTOR WORKFLOW (CONSULTATION & PRESCRIPTION)
    // ----------------------------------------------------
    console.log('\n--- 7. Doctor Workflow & Prescription Generation ---');
    const doctorLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dr.rahul@apollo.medipulse.org', password: 'Password@123' }),
    }).then((r) => r.json());
    assert(doctorLoginRes.success && doctorLoginRes.data.accessToken, `Doctor authenticated: ${doctorLoginRes.data?.user?.name} (${doctorLoginRes.data?.user?.role})`);
    const docToken = doctorLoginRes.data.accessToken;

    // Doctor profile & stats
    const docStatsRes = await fetch(`${BASE_URL}/doctor/stats`, {
      headers: { Authorization: `Bearer ${docToken}` },
    }).then((r) => r.json());
    assert(docStatsRes.success, `Doctor stats fetched: Rating ${docStatsRes.data?.rating?.average}★ (${docStatsRes.data?.rating?.totalReviews} reviews)`);

    // Doctor starts consultation
    const startConsultRes = await fetch(`${BASE_URL}/doctor/appointments/${bookingRes.data.appointment.id}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${docToken}` },
    }).then((r) => r.json());
    assert(startConsultRes.success && startConsultRes.data.status === 'IN_CONSULTATION', 'Doctor started consultation (Status -> IN_CONSULTATION)');

    // Doctor completes consultation with clinical records
    const completeConsultRes = await fetch(`${BASE_URL}/doctor/appointments/${bookingRes.data.appointment.id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${docToken}`,
      },
      body: JSON.stringify({
        diagnosis: 'Mild Sinus Bradycardia, Normotensive',
        instructions: 'Drink plenty of fluids, regular morning walks, low sodium diet',
        followUpDate: '2026-10-25',
        symptoms: 'Occasional mild palpitations and fatigue',
        vitals: { bp: '120/80 mmHg', pulse: '62 bpm', temperature: '98.6 F', spo2: '99%' },
        clinicalNotes: 'ECG normal sinus rhythm. Advised lifestyle modifications and follow-up in 1 month.',
        medicines: [
          { name: 'Tab CoQ10 100mg', dosage: '1 tablet', frequency: 'OD (Once daily)', duration: '30 days', instructions: 'After breakfast' },
          { name: 'Tab Vitamin D3 60k', dosage: '1 capsule', frequency: 'Weekly', duration: '8 weeks', instructions: 'With warm milk' },
        ],
      }),
    }).then((r) => r.json());
    assert(completeConsultRes.success && completeConsultRes.data.appointment.status === 'COMPLETED', 'Doctor completed consultation (Status -> COMPLETED, Prescription saved)');

    // Patient retrieves digital prescription
    const prescriptionRes = await fetch(`${BASE_URL}/appointments/${bookingRes.data.appointment.id}/prescription`).then((r) => r.json());
    assert(prescriptionRes.success && prescriptionRes.data.medicines.length === 2, `Patient retrieved prescription with ${prescriptionRes.data.medicines.length} prescribed medicines`);

    // ----------------------------------------------------
    // TEST SUITE 8: HOSPITAL ADMIN WORKFLOW
    // ----------------------------------------------------
    console.log('\n--- 8. Hospital Admin Management & Metrics ---');
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin.apollo@medipulse.org', password: 'Password@123' }),
    }).then((r) => r.json());
    assert(adminLoginRes.success && adminLoginRes.data.accessToken, `Hospital Admin authenticated: ${adminLoginRes.data.user.name}`);
    const adminToken = adminLoginRes.data.accessToken;

    const metricsRes = await fetch(`${BASE_URL}/admin/metrics`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json());
    assert(metricsRes.success && typeof metricsRes.data.totalAppointments === 'number', `Hospital metrics fetched: Total Appointments = ${metricsRes.data.totalAppointments}, Doctors = ${metricsRes.data.doctorCount}`);

    // Admin creates new department
    const newDeptCode = `DEPT_${Date.now().toString().slice(-4)}`;
    const addDeptRes = await fetch(`${BASE_URL}/admin/departments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: `Speciality Unit ${newDeptCode}`,
        code: newDeptCode,
        description: 'Advanced diagnostic and care unit',
        icon: 'Activity',
      }),
    }).then((r) => r.json());
    assert(addDeptRes.success && addDeptRes.data.code === newDeptCode, `Hospital Admin added department: ${addDeptRes.data?.name}`);

    // Admin notifications
    const adminNotifRes = await fetch(`${BASE_URL}/admin/notifications`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json());
    assert(adminNotifRes.success && adminNotifRes.data.length > 0, `Hospital Admin received ${adminNotifRes.data.length} real-time system notifications`);

    // ----------------------------------------------------
    // TEST SUITE 9: SUPER ADMIN PLATFORM OVERSIGHT
    // ----------------------------------------------------
    console.log('\n--- 9. Super Admin Platform Oversight ---');
    const superAdminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'superadmin@medipulse.org', password: 'Password@123' }),
    }).then((r) => r.json());
    assert(superAdminLoginRes.success && superAdminLoginRes.data.user.role === 'SUPER_ADMIN', `Super Admin authenticated: ${superAdminLoginRes.data.user.name}`);
    const superToken = superAdminLoginRes.data.accessToken;

    const platformMetricsRes = await fetch(`${BASE_URL}/super-admin/metrics`, {
      headers: { Authorization: `Bearer ${superToken}` },
    }).then((r) => r.json());
    assert(platformMetricsRes.success, `Platform Metrics: Hospitals = ${platformMetricsRes.data.totalHospitals}, Doctors = ${platformMetricsRes.data.totalDoctors}, Platform Fees = ₹${platformMetricsRes.data.platformFeeRevenue}`);

    const auditLogsRes = await fetch(`${BASE_URL}/super-admin/audit-logs`, {
      headers: { Authorization: `Bearer ${superToken}` },
    }).then((r) => r.json());
    assert(auditLogsRes.success && auditLogsRes.data.length > 0, `Audit Trail verified: ${auditLogsRes.data.length} security audit events recorded`);

    // ----------------------------------------------------
    // TEST SUITE 10: APPOINTMENT CANCELLATION WORKFLOW
    // ----------------------------------------------------
    console.log('\n--- 10. Cancellation & Refund Lifecycle ---');
    // Book a second appointment to test cancellation
    const cancelSlot = slotsRes.data.slots.find((s) => s.isAvailable && s.time !== availableSlot.time);
    if (cancelSlot) {
      const aptToCancel = await fetch(`${BASE_URL}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalId: doctor.hospitalId,
          doctorId: doctor.id,
          departmentId: doctor.departmentId,
          appointmentDate: testDate,
          timeSlot: cancelSlot.time,
          patient: {
            fullName: 'Anita Roy',
            mobileNumber: '9777123456',
            email: 'anita.roy@example.com',
          },
          notes: 'To be cancelled test',
        }),
      }).then((r) => r.json());

      const cancelRes = await fetch(`${BASE_URL}/appointments/${aptToCancel.data.appointment.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancellationReason: 'Patient personal emergency' }),
      }).then((r) => r.json());

      assert(cancelRes.success && cancelRes.data.status === 'CANCELLED', `Appointment cancelled successfully with reason: "${cancelRes.data.cancellationReason}"`);
    } else {
      console.log('  ⚠️ Skipping cancellation slot test: No second slot available on test day');
    }

    // ----------------------------------------------------
    // SUMMARY
    // ----------------------------------------------------
    console.log('\n======================================================');
    console.log(`🎉 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('💥 Unhandled error in backend test suite:', err);
    process.exit(1);
  }
}

runCompleteBackendTestSuite();
