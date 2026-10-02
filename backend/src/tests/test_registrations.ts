import { PrismaClient } from '@prisma/client';
import {
  registerHospitalSchema,
  registerDoctorSchema,
  registerLabSchema,
  registerSupportStaffSchema,
  registerPharmacySchema,
} from '../validators/schemas';
import { AuthController } from '../controllers/auth.controller';
import express, { Request, Response } from 'express';

const prisma = new PrismaClient();

async function runTests() {
  console.log('🚀 Starting Comprehensive Registration Validation & Execution Tests...\n');

  // Find an existing hospital to link registrations with
  const hospital = await prisma.hospital.findFirst({
    include: { departments: true },
  });

  if (!hospital) {
    console.error('❌ No hospital found in database! Seed might be needed.');
    process.exit(1);
  }

  console.log(`🏥 Using test hospital: "${hospital.name}" (ID: ${hospital.id})`);
  const department = hospital.departments[0];
  console.log(`🩺 Using test department: "${department?.name || 'N/A'}" (ID: ${department?.id || 'N/A'})\n`);

  const timestamp = Date.now();

  // Helper to create mock Express req/res
  function createMockReqRes(body: any) {
    let statusCode = 200;
    let responseBody: any = null;

    const req = {
      body,
      ip: '127.0.0.1',
      headers: { 'user-agent': 'Automated-Test-Runner' },
    } as unknown as Request;

    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        responseBody = data;
        return this;
      },
    } as unknown as Response;

    return {
      req,
      res,
      getResult: () => ({ statusCode, body: responseBody }),
    };
  }

  let totalPassed = 0;
  let totalFailed = 0;

  // -------------------------------------------------------------
  // TEST 1: Pharmacy Registration
  // -------------------------------------------------------------
  console.log('--- TEST 1: Pharmacy Registration ---');
  const pharmacyPayload = {
    name: `Apex Care Pharmacy ${timestamp}`,
    licenseNumber: `DL-20B/HYD/${timestamp % 10000}`,
    hospitalId: hospital.id,
    email: `pharmacy.${timestamp}@medpulse.test`,
    password: 'Password@123',
    staffPassword: 'Password@123',
    contactPerson: 'Mr. V. K. Gupta (B.Pharm)',
    staffName: 'Mr. V. K. Gupta (B.Pharm)',
    phone: '+91 98480 12345',
    address: 'Ground Floor, OPD Wing, Counter 1',
  };

  try {
    const validated = registerPharmacySchema.parse(pharmacyPayload);
    console.log('  ✅ Schema validation passed for Pharmacy payload');

    const mock = createMockReqRes(pharmacyPayload);
    await AuthController.registerPharmacy(mock.req, mock.res);
    const result = mock.getResult();

    if (result.statusCode === 201 && result.body.success) {
      console.log('  ✅ Pharmacy Controller registration SUCCEEDED:', result.body.data);
      totalPassed++;
    } else {
      console.error('  ❌ Pharmacy Controller registration FAILED:', result.statusCode, result.body);
      totalFailed++;
    }
  } catch (err: any) {
    console.error('  ❌ Pharmacy registration threw error:', err.message, err.errors || '');
    totalFailed++;
  }

  // -------------------------------------------------------------
  // TEST 2: Doctor Registration
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Doctor Registration ---');
  const doctorPayload = {
    name: `Dr. Rajesh Sharma ${timestamp % 1000}`,
    email: `dr.rajesh.${timestamp}@medpulse.test`,
    password: 'Password@123',
    phone: '+91 98765 43210',
    hospitalId: hospital.id,
    departmentId: department?.id || '',
    qualification: 'MBBS, MD (General Medicine)',
    specialization: 'Internal Medicine',
    experienceYears: 12,
    consultationFee: 750,
    languages: 'English, Hindi, Telugu',
    about: 'Senior physician with over a decade of clinical experience in acute illness and chronic disease management.',
    workingDays: 'Mon,Tue,Wed,Thu,Fri',
    workingHoursStart: '09:00',
    workingHoursEnd: '17:00',
    slotDurationMinutes: 30,
  };

  try {
    const validated = registerDoctorSchema.parse(doctorPayload);
    console.log('  ✅ Schema validation passed for Doctor payload');

    const mock = createMockReqRes(doctorPayload);
    await AuthController.registerDoctor(mock.req, mock.res);
    const result = mock.getResult();

    if (result.statusCode === 201 && result.body.success) {
      console.log('  ✅ Doctor Controller registration SUCCEEDED:', result.body.data);
      totalPassed++;
    } else {
      console.error('  ❌ Doctor Controller registration FAILED:', result.statusCode, result.body);
      totalFailed++;
    }
  } catch (err: any) {
    console.error('  ❌ Doctor registration threw error:', err.message, err.errors || '');
    totalFailed++;
  }

  // -------------------------------------------------------------
  // TEST 3: Diagnostic Lab Registration (Hospital-associated)
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Diagnostic Lab Registration (Hospital) ---');
  const labPayload = {
    name: `Central Diagnostic Lab ${timestamp}`,
    licenseNumber: `NABL-${timestamp % 10000}`,
    type: 'HOSPITAL',
    hospitalId: hospital.id,
    email: `lab.${timestamp}@medpulse.test`,
    adminPassword: 'Password@123',
    password: 'Password@123',
    adminName: 'Dr. Sunita Reddy',
    contactPerson: 'Dr. Sunita Reddy',
    phone: '+91 91234 56789',
    address: 'Basement Level 1, Diagnostics Wing',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500033',
  };

  try {
    const validated = registerLabSchema.parse(labPayload);
    console.log('  ✅ Schema validation passed for Lab payload');

    const mock = createMockReqRes(labPayload);
    await AuthController.registerLab(mock.req, mock.res);
    const result = mock.getResult();

    if (result.statusCode === 201 && result.body.success) {
      console.log('  ✅ Lab Controller registration SUCCEEDED:', result.body.data);
      totalPassed++;
    } else {
      console.error('  ❌ Lab Controller registration FAILED:', result.statusCode, result.body);
      totalFailed++;
    }
  } catch (err: any) {
    console.error('  ❌ Lab registration threw error:', err.message, err.errors || '');
    totalFailed++;
  }

  // -------------------------------------------------------------
  // TEST 4: Diagnostic Lab Registration (Independent)
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Diagnostic Lab Registration (Independent) ---');
  const indLabPayload = {
    name: `Apex Independent Pathlabs ${timestamp}`,
    licenseNumber: `NABL-IND-${timestamp % 10000}`,
    type: 'INDEPENDENT',
    hospitalId: undefined,
    email: `indlab.${timestamp}@medpulse.test`,
    adminPassword: 'Password@123',
    password: 'Password@123',
    adminName: 'Dr. Anand Kumar',
    contactPerson: 'Dr. Anand Kumar',
    phone: '+91 91234 99999',
    address: 'Plot 45, Main Road, Somajiguda',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500082',
  };

  try {
    const validated = registerLabSchema.parse(indLabPayload);
    console.log('  ✅ Schema validation passed for Independent Lab payload');

    const mock = createMockReqRes(indLabPayload);
    await AuthController.registerLab(mock.req, mock.res);
    const result = mock.getResult();

    if (result.statusCode === 201 && result.body.success) {
      console.log('  ✅ Independent Lab Controller registration SUCCEEDED:', result.body.data);
      totalPassed++;
    } else {
      console.error('  ❌ Independent Lab Controller registration FAILED:', result.statusCode, result.body);
      totalFailed++;
    }
  } catch (err: any) {
    console.error('  ❌ Independent Lab registration threw error:', err.message, err.errors || '');
    totalFailed++;
  }

  // -------------------------------------------------------------
  // TEST 5: Support Staff Registration
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Support Staff Registration ---');
  const staffPayload = {
    name: `Nurse Sunita Sharma ${timestamp % 1000}`,
    email: `staff.${timestamp}@medpulse.test`,
    password: 'Password@123',
    phone: '+91 97777 88888',
    hospitalId: hospital.id,
    roleTitle: 'Triage & Screening Nurse',
    department: 'Outpatient Department (OPD)',
  };

  try {
    const validated = registerSupportStaffSchema.parse(staffPayload);
    console.log('  ✅ Schema validation passed for Support Staff payload');

    const mock = createMockReqRes(staffPayload);
    await AuthController.registerSupportStaff(mock.req, mock.res);
    const result = mock.getResult();

    if (result.statusCode === 201 && result.body.success) {
      console.log('  ✅ Support Staff Controller registration SUCCEEDED:', result.body.data);
      totalPassed++;
    } else {
      console.error('  ❌ Support Staff Controller registration FAILED:', result.statusCode, result.body);
      totalFailed++;
    }
  } catch (err: any) {
    console.error('  ❌ Support Staff registration threw error:', err.message, err.errors || '');
    totalFailed++;
  }

  // -------------------------------------------------------------
  // TEST 6: Hospital Registration (With empty optional fields like code, password)
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Hospital Registration (with empty optional fields) ---');
  const hospitalPayload = {
    name: `Sunrise Global Hospital ${timestamp % 10000}`,
    code: '', // Testing empty string from frontend input!
    licenseNumber: `REG-MED-${timestamp % 10000}`,
    email: `sunrise.${timestamp}@medpulse.test`,
    phone: '+91 40 2233 4455',
    emergencyContact: '',
    address: 'Sy No 42, Hitec City Phase 2',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500081',
    website: '',
    openingHours: '24/7 (Emergency), OPD: 08:30 AM - 08:00 PM',
    about: 'State-of-the-art super specialty tertiary healthcare institute offering cardiology, oncology, and robotic surgery.',
    facilities: ['24/7 Emergency & Trauma Care', 'In-house 24/7 Pharmacy', 'Advanced Pathology Laboratory'],
    adminName: 'Dr. Vikramaditya Raju',
    adminEmail: `admin.sunrise.${timestamp}@medpulse.test`,
    adminPhone: '+91 98888 77777',
    adminPassword: '', // Testing empty string from frontend input!
  };

  try {
    const validated = registerHospitalSchema.parse(hospitalPayload);
    console.log('  ✅ Schema validation passed for Hospital payload');

    const mock = createMockReqRes(hospitalPayload);
    await AuthController.registerHospital(mock.req, mock.res);
    const result = mock.getResult();

    if (result.statusCode === 201 && result.body.success) {
      console.log('  ✅ Hospital Controller registration SUCCEEDED:', result.body.data);
      totalPassed++;
    } else {
      console.error('  ❌ Hospital Controller registration FAILED:', result.statusCode, result.body);
      totalFailed++;
    }
  } catch (err: any) {
    console.error('  ❌ Hospital registration threw error:', err.message, err.errors || '');
    totalFailed++;
  }

  console.log(`\n========================================`);
  console.log(`📊 Test Summary: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log(`========================================\n`);

  await prisma.$disconnect();
}

runTests().catch(async (e) => {
  console.error('Fatal test runner error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
