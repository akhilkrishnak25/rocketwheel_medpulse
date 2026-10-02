import http from 'http';
import app from '../app';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PORT = 5899;

async function runHttpTests() {
  console.log('🌐 Starting HTTP Integration Tests for all Registration Endpoints...\n');

  // Start Express server on PORT 5899
  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(PORT, () => {
      console.log(`📡 Test server running on http://127.0.0.1:${PORT}`);
      resolve();
    });
  });

  const baseUrl = `http://127.0.0.1:${PORT}/api/auth`;

  // Fetch a seeded hospital for relational testing
  const hospital = await prisma.hospital.findFirst({
    include: { departments: true },
  });

  if (!hospital) {
    console.error('❌ Hospital not found for tests');
    server.close();
    process.exit(1);
  }

  const department = hospital.departments[0];
  const ts = Date.now();
  let passed = 0;
  let failed = 0;

  async function postJson(endpoint: string, payload: any) {
    const res = await fetch(`${baseUrl}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data: any = await res.json();
    return { status: res.status, data };
  }

  // TEST 1: Pharmacy Registration HTTP
  console.log('--- TEST 1: POST /register-pharmacy (Frontend payload style) ---');
  const pharmacyPayload = {
    name: `City Care Pharmacy ${ts}`,
    licenseNumber: `DL-20B-${ts % 10000}`,
    hospitalId: hospital.id,
    email: `pharmacy.${ts}@medpulse.test`,
    password: 'Password@123',
    contactPerson: 'Mr. V. K. Gupta (B.Pharm)',
    phone: '+91 98480 12345',
    address: 'Ground Floor, OPD Wing, Counter 1',
  };

  const phRes = await postJson('register-pharmacy', pharmacyPayload);
  if (phRes.status === 201 && phRes.data.success) {
    console.log('  ✅ Pharmacy registration succeeded:', phRes.data.data.name);
    passed++;
  } else {
    console.error('  ❌ Pharmacy registration failed:', phRes.status, phRes.data);
    failed++;
  }

  // TEST 2: Pharmacy Registration - Duplicate Email Handling
  console.log('\n--- TEST 2: POST /register-pharmacy (Duplicate email rejection) ---');
  const dupPhRes = await postJson('register-pharmacy', pharmacyPayload);
  if (dupPhRes.status === 400 && dupPhRes.data.message?.includes('already exists')) {
    console.log('  ✅ Correctly rejected duplicate email with clean message:', dupPhRes.data.message);
    passed++;
  } else {
    console.error('  ❌ Duplicate email test unexpected result:', dupPhRes);
    failed++;
  }

  // TEST 3: Doctor Registration HTTP
  console.log('\n--- TEST 3: POST /register-doctor ---');
  const docPayload = {
    name: `Dr. Ananya Sen ${ts % 1000}`,
    email: `dr.ananya.${ts}@medpulse.test`,
    password: 'Password@123',
    phone: '+91 98765 11111',
    hospitalId: hospital.id,
    departmentId: department.id,
    qualification: 'MBBS, MD',
    specialization: department.name,
    experienceYears: 8,
    consultationFee: 600,
    languages: 'English, Hindi',
    about: 'Consultant physician specializing in internal medicine and outpatient primary care.',
  };

  const docRes = await postJson('register-doctor', docPayload);
  if (docRes.status === 201 && docRes.data.success) {
    console.log('  ✅ Doctor registration succeeded:', docRes.data.data.name);
    passed++;
  } else {
    console.error('  ❌ Doctor registration failed:', docRes.status, docRes.data);
    failed++;
  }

  // TEST 4: Diagnostic Lab (Hospital-linked) HTTP
  console.log('\n--- TEST 4: POST /register-lab (Hospital-linked) ---');
  const labPayload = {
    name: `MedPulse Advanced Diagnostic Lab ${ts}`,
    licenseNumber: `NABL-${ts % 10000}`,
    type: 'HOSPITAL',
    hospitalId: hospital.id,
    email: `lab.hosp.${ts}@medpulse.test`,
    password: 'Password@123',
    contactPerson: 'Dr. Suresh Babu',
    phone: '+91 40 2233 4455',
    address: 'Pathology Wing, Ground Floor',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500033',
  };

  const labRes = await postJson('register-lab', labPayload);
  if (labRes.status === 201 && labRes.data.success) {
    console.log('  ✅ Hospital lab registration succeeded:', labRes.data.data.labName);
    passed++;
  } else {
    console.error('  ❌ Hospital lab registration failed:', labRes.status, labRes.data);
    failed++;
  }

  // TEST 5: Diagnostic Lab (Independent) HTTP
  console.log('\n--- TEST 5: POST /register-lab (Independent) ---');
  const indLabPayload = {
    name: `Standalone Diagnostics Care ${ts}`,
    licenseNumber: `NABL-IND-${ts % 10000}`,
    type: 'INDEPENDENT',
    email: `lab.ind.${ts}@medpulse.test`,
    password: 'Password@123',
    contactPerson: 'Dr. Ramesh Chandra',
    phone: '+91 99887 66554',
    address: 'Plot 12, Main Road, Banjara Hills',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500034',
  };

  const indLabRes = await postJson('register-lab', indLabPayload);
  if (indLabRes.status === 201 && indLabRes.data.success) {
    console.log('  ✅ Independent lab registration succeeded:', indLabRes.data.data.labName);
    passed++;
  } else {
    console.error('  ❌ Independent lab registration failed:', indLabRes.status, indLabRes.data);
    failed++;
  }

  // TEST 6: Support Staff Registration HTTP
  console.log('\n--- TEST 6: POST /register-support-staff ---');
  const staffPayload = {
    name: `Nurse Meena Kumari ${ts % 1000}`,
    email: `nurse.meena.${ts}@medpulse.test`,
    password: 'Password@123',
    phone: '+91 91111 22222',
    hospitalId: hospital.id,
    roleTitle: 'Triage Nurse',
    department: 'Cardiology',
  };

  const staffRes = await postJson('register-support-staff', staffPayload);
  if (staffRes.status === 201 && staffRes.data.success) {
    console.log('  ✅ Support staff registration succeeded:', staffRes.data.data.name);
    passed++;
  } else {
    console.error('  ❌ Support staff registration failed:', staffRes.status, staffRes.data);
    failed++;
  }

  // TEST 7: Hospital Registration HTTP (Empty optional fields)
  console.log('\n--- TEST 7: POST /register-hospital ---');
  const hospPayload = {
    name: `Care Multi-Speciality Center ${ts % 10000}`,
    code: '',
    email: `admin.care.${ts}@medpulse.test`,
    phone: '+91 40 3344 5566',
    emergencyContact: '',
    address: 'Survey 108, Jubilee Hills',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500033',
    website: '',
    openingHours: '24/7 (Emergency), OPD: 08:30 AM - 08:00 PM',
    about: 'Premier hospital facility offering tertiary and quaternary care services.',
    facilities: ['24/7 Emergency Care', 'In-house Pharmacy'],
    adminName: 'Sanjay Verma',
    adminEmail: `sanjay.verma.${ts}@medpulse.test`,
    adminPhone: '+91 99000 11223',
    adminPassword: '',
  };

  const hospRes = await postJson('register-hospital', hospPayload);
  if (hospRes.status === 201 && hospRes.data.success) {
    console.log('  ✅ Hospital registration succeeded:', hospRes.data.data.hospitalName);
    passed++;
  } else {
    console.error('  ❌ Hospital registration failed:', hospRes.status, hospRes.data);
    failed++;
  }

  // TEST 8: Validation Error Formatting HTTP (Missing required fields)
  console.log('\n--- TEST 8: Validation error formatting on malformed input ---');
  const badRes = await postJson('register-pharmacy', {
    name: 'X', // too short
    email: 'not-an-email',
  });
  if (badRes.status === 400 && !badRes.data.success) {
    console.log('  ✅ Correctly caught validation error with readable message:', badRes.data.message);
    passed++;
  } else {
    console.error('  ❌ Expected validation error but got:', badRes);
    failed++;
  }

  console.log(`\n========================================`);
  console.log(`🌐 HTTP Integration Summary: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  server.close();
  await prisma.$disconnect();
}

runHttpTests().catch(async (err) => {
  console.error('Fatal HTTP test runner error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
