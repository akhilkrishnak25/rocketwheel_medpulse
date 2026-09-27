async function testBookingFlow() {
  console.log('Testing booking flow...');

  // 1. Fetch Apollo doctors
  const doctorsRes = await fetch('http://localhost:5000/api/hospitals/e7c8f5e8-10e9-42f4-9d13-3df4051ab5bf/doctors').then(r => r.json());
  const doctor = doctorsRes.data[0];
  console.log('Selected Doctor:', doctor.name);

  // 2. Fetch slots for 2026-09-28
  const slotsRes = await fetch(`http://localhost:5000/api/doctors/${doctor.id}/availability?date=2026-09-28`).then(r => r.json());
  const availableSlot = slotsRes.data.slots.find(s => s.isAvailable);
  console.log('Selected Slot:', availableSlot.time);

  // 3. Create pending appointment
  const bookRes = await fetch('http://localhost:5000/api/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hospitalId: doctor.hospitalId,
      doctorId: doctor.id,
      departmentId: doctor.departmentId,
      appointmentDate: '2026-09-28',
      timeSlot: availableSlot.time,
      patient: {
        fullName: 'Arun Varma',
        mobileNumber: '9845112233',
        email: 'arun.varma@example.com',
        gender: 'Male',
        bloodGroup: 'O+'
      },
      notes: 'Consultation for annual health checkup'
    })
  }).then(r => r.json());

  console.log('Pending Appointment Created:', bookRes.data.appointment.appointmentNumber);
  console.log('Order ID:', bookRes.data.paymentOrder.orderId);

  // 4. Test Double Booking Prevention: Attempt to book the EXACT SAME slot immediately!
  const doubleBookRes = await fetch('http://localhost:5000/api/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hospitalId: doctor.hospitalId,
      doctorId: doctor.id,
      departmentId: doctor.departmentId,
      appointmentDate: '2026-09-28',
      timeSlot: availableSlot.time,
      patient: {
        fullName: 'Another Patient',
        mobileNumber: '9111122222',
        email: 'another@example.com'
      }
    })
  }).then(r => r.json());

  console.log('Double booking check prevented successfully?:', !doubleBookRes.success, '| Reason:', doubleBookRes.message);

  // 5. Confirm Payment
  const confirmRes = await fetch('http://localhost:5000/api/appointments/confirm-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appointmentId: bookRes.data.appointment.id,
      razorpayOrderId: bookRes.data.paymentOrder.orderId,
      razorpayPaymentId: 'pay_test_txn_98765',
      razorpaySignature: `simulated_sig_${bookRes.data.paymentOrder.orderId}`
    })
  }).then(r => r.json());

  console.log('Payment Verified & Confirmed! OP Number:', confirmRes.data.digitalOp.opNumber);
  console.log('Secure Token:', confirmRes.data.digitalOp.secureToken);

  // 6. Test QR Code Verification Endpoint
  const qrRes = await fetch(`http://localhost:5000/api/appointments/verify-op/${confirmRes.data.digitalOp.secureToken}`).then(r => r.json());
  console.log('QR Verification Output:\n', JSON.stringify(qrRes.data, null, 2));

  // 7. Test PDF Generation
  const pdfRes = await fetch(`http://localhost:5000/api/appointments/${bookRes.data.appointment.id}/pdf`);
  console.log('PDF Status:', pdfRes.status, 'Content-Type:', pdfRes.headers.get('content-type'));

  // 8. Test Hospital Admin Notifications
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin.apollo@medipulse.org', password: 'Password@123' })
  }).then(r => r.json());

  const notifRes = await fetch('http://localhost:5000/api/admin/notifications', {
    headers: { Authorization: `Bearer ${loginRes.data.accessToken}` }
  }).then(r => r.json());

  console.log('\nHospital Admin latest system notification:');
  console.log('--------------------------------------------------');
  console.log(notifRes.data[0].message);
  console.log('--------------------------------------------------');
}

testBookingFlow();
