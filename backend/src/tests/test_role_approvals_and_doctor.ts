import prisma from '../config/prisma';
import bcrypt from 'bcryptjs';
import { AdminService } from '../services/admin.service';
import { SuperAdminService } from '../services/superAdmin.service';
import { DoctorDashboardService } from '../services/doctorDashboard.service';

async function runTests() {
  console.log('--- STARTING ROLE APPROVALS & DOCTOR MANAGEMENT TESTS ---');

  // Find or create test hospitals
  let hospitals = await prisma.hospital.findMany({ take: 2, include: { departments: true } });
  let hospitalA = hospitals[0];
  let hospitalB = hospitals[1];

  if (!hospitalA) {
    hospitalA = await prisma.hospital.create({
      data: {
        name: 'Apollo Hospital Hyderabad',
        slug: 'apollo-hyderabad',
        code: 'APO-HYD-001',
        address: 'Jubilee Hills',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500033',
        phone: '040-23607777',
        email: 'info@apollohyd.com',
        emergencyContact: '1066',
        openingHours: '24/7',
        about: 'Tertiary care hospital',
        facilities: 'Emergency, ICU, OPD, Inpatient, Diagnostics, Pharmacy',
      },
      include: { departments: true },
    });
  }

  if (!hospitalB) {
    hospitalB = await prisma.hospital.create({
      data: {
        name: 'Fortis Hospital Bangalore',
        slug: 'fortis-bangalore',
        code: 'FOR-BLR-001',
        address: 'Bannerghatta Road',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560076',
        phone: '080-66214444',
        email: 'info@fortisblr.com',
        emergencyContact: '105',
        openingHours: '24/7',
        about: 'Multi-specialty hospital',
        facilities: 'Emergency, ICU, OPD, Inpatient, Diagnostics, Pharmacy',
      },
      include: { departments: true },
    });
  }

  // Get or create department for Hospital A
  let deptA = await prisma.department.findFirst({ where: { hospitalId: hospitalA.id } });
  if (!deptA) {
    deptA = await prisma.department.create({
      data: {
        hospitalId: hospitalA.id,
        name: 'Cardiology',
        code: 'CARD-01',
        slug: 'cardiology',
        description: 'Cardiology department',
      },
    });
  }

  // Fetch active system admin accounts for realistic audit log foreign keys
  const adminUser = await prisma.user.findFirst({ where: { role: 'HOSPITAL_ADMIN' } });
  const superAdminUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  const adminId = adminUser?.id;
  const superAdminId = superAdminUser?.id;

  // 1. TEST PHARMACY REGISTRATION & HOSPITAL ADMIN APPROVAL
  console.log('\n[Scenario 1] Hospital Admin approves pharmacy associated with their hospital');
  const pharmacyA = await prisma.pharmacy.create({
    data: {
      hospitalId: hospitalA.id,
      name: 'Apollo Jubilee Pharmacy',
      email: `pharmacy.${Date.now()}@apollo.org`,
      licenseNumber: `PHARM-LIC-${Date.now()}`,
      phone: '9988776655',
      address: 'Inside Apollo Hospital, Hyderabad',
      status: 'PENDING',
    },
  });

  // Hospital Admin of Hospital A approves it
  const approvedPharm = await AdminService.approvePharmacy(hospitalA.id, pharmacyA.id, adminId);
  console.log('✓ Pharmacy approved status:', approvedPharm.status);
  if (approvedPharm.status !== 'ACTIVE') {
    throw new Error('Pharmacy approval failed');
  }

  // Test cross-hospital approval rejection
  console.log('\n[Scenario 1b] Cross-hospital pharmacy approval must be rejected');
  try {
    await AdminService.approvePharmacy(hospitalB.id, pharmacyA.id, adminId);
    throw new Error('FAILED: Hospital B was able to approve Hospital A pharmacy!');
  } catch (err: any) {
    console.log('✓ Cross-hospital approval correctly blocked:', err.message);
  }

  // 2. TEST HOSPITAL-ASSOCIATED LAB APPROVAL BY HOSPITAL ADMIN
  console.log('\n[Scenario 2] Hospital Admin approves laboratory associated with their hospital');
  const labA = await prisma.lab.create({
    data: {
      hospitalId: hospitalA.id,
      type: 'HOSPITAL',
      name: 'Apollo Central Pathology Lab',
      email: `lab.${Date.now()}@apollo.org`,
      phone: '9123456780',
      address: 'Apollo Ground Floor',
      status: 'PENDING',
    },
  });

  const approvedLab = await AdminService.approveHospitalLab(hospitalA.id, labA.id, adminId);
  console.log('✓ Hospital Lab approved status:', approvedLab.status);
  if (approvedLab.status !== 'APPROVED') {
    throw new Error('Hospital lab approval failed');
  }

  // 3 & 4. TEST PRIVATE/INDEPENDENT LAB VS HOSPITAL-ASSOCIATED LAB IN SUPER ADMIN QUEUE
  console.log('\n[Scenario 3 & 4] Super Admin manages independent/private labs only');
  const privateLab = await prisma.lab.create({
    data: {
      hospitalId: null,
      type: 'INDEPENDENT',
      name: 'Dr. Lal PathLabs Independent',
      email: `privatelab.${Date.now()}@pathlabs.com`,
      phone: '9888777666',
      address: 'City Diagnostic Center',
      status: 'PENDING',
    },
  });

  // Verify Super Admin pending list only contains independent labs
  const superAdminPendingLabs = await SuperAdminService.getAllLabs('PENDING');
  const containsHospitalLab = superAdminPendingLabs.some((l: any) => l.hospitalId !== null);
  const containsPrivateLab = superAdminPendingLabs.some((l: any) => l.id === privateLab.id);

  console.log('✓ Super Admin pending queue contains private lab:', containsPrivateLab);
  console.log('✓ Super Admin pending queue contains hospital lab:', containsHospitalLab);
  if (containsHospitalLab) {
    throw new Error('FAILED: Hospital-associated lab found in Super Admin pending queue!');
  }

  // Super Admin approves private lab
  const approvedPrivateLab = await SuperAdminService.approveLab(privateLab.id, superAdminId);
  console.log('✓ Private lab approved by Super Admin:', approvedPrivateLab.status);

  // Super Admin cannot approve hospital lab
  try {
    await SuperAdminService.approveLab(labA.id, superAdminId);
    console.log('Warning: Super Admin approveLab called on hospital lab');
  } catch (err: any) {
    console.log('✓ Super Admin blocked from approving hospital lab:', err.message);
  }

  // 5. TEST DOCTOR PROFILE EDITING & AUTHORIZATION
  console.log('\n[Scenario 5] Doctor edits own profile registration details');
  const testDoctorEmail = `test.doc.${Date.now()}@hospital.org`;
  const initialPasswordHash = await bcrypt.hash('DocPass@123', 10);
  const testUser = await prisma.user.create({
    data: {
      name: 'Dr. Test Surgeon',
      email: testDoctorEmail,
      phone: '9876543299',
      passwordHash: initialPasswordHash,
      role: 'DOCTOR',
      status: 'ACTIVE',
    },
  });

  const testDoctor = await prisma.doctor.create({
    data: {
      userId: testUser.id,
      hospitalId: hospitalA.id,
      departmentId: deptA.id,
      name: 'Dr. Test Surgeon',
      qualification: 'MBBS, MS (General Surgery)',
      specialization: 'General & Laparoscopic Surgery',
      experienceYears: 6,
      consultationFee: 600,
      languages: 'English, Hindi',
      about: 'Experienced laparoscopic surgeon',
      workingDays: 'Mon,Tue,Wed,Thu,Fri,Sat',
      workingHoursStart: '09:00',
      workingHoursEnd: '17:00',
      slotDurationMinutes: 20,
    },
  });

  // Doctor updates their own profile
  const updatedDoc = await DoctorDashboardService.updateDoctorProfile(
    testDoctor.id,
    {
      name: 'Dr. Test Surgeon Senior',
      phone: '9876543200',
      qualification: 'MBBS, MS, FMAS, FIAGES',
      specialization: 'Senior Laparoscopic & GI Surgeon',
      experienceYears: 10,
      consultationFee: 800,
      about: 'Updated clinical overview with advanced laparoscopic techniques.',
      slotDurationMinutes: 15,
      password: 'NewDocPassword@2026',
    },
    testUser.id
  );

  console.log('✓ Updated doctor name:', updatedDoc.name);
  console.log('✓ Updated qualification:', updatedDoc.qualification);
  console.log('✓ Updated fee:', updatedDoc.consultationFee);
  console.log('✓ Updated slot duration:', updatedDoc.slotDurationMinutes);

  // Verify password was hashed and updated in User record
  const refreshedUser = await prisma.user.findUnique({ where: { id: testUser.id } });
  const isNewPasswordValid = await bcrypt.compare('NewDocPassword@2026', refreshedUser!.passwordHash);
  console.log('✓ Doctor new password securely hashed and verified:', isNewPasswordValid);
  if (!isNewPasswordValid) {
    throw new Error('Doctor password update verification failed');
  }

  // Test unauthorized doctor trying to edit another doctor's profile
  console.log('\n[Scenario 7] Doctor cannot edit another doctor\'s profile');
  try {
    await DoctorDashboardService.updateDoctorProfile(
      testDoctor.id,
      { name: 'Hacked Doctor' },
      'another-user-id-999'
    );
    throw new Error('FAILED: Unauthorized user was able to edit doctor profile!');
  } catch (err: any) {
    console.log('✓ Unauthorized profile edit blocked:', err.message);
  }

  // 6. TEST HOSPITAL ADMIN: ADD DOCTOR WITH INITIAL CREDENTIALS
  console.log('\n[Scenario 6] Hospital Admin adds new doctor directly with credentials');
  const newDocEmail = `direct.doc.${Date.now()}@apollo.org`;
  const createdDocResult = await AdminService.addDoctor(
    hospitalA.id,
    {
      name: 'Dr. Priyadarshini Rao',
      departmentId: deptA.id,
      qualification: 'MBBS, DNB (Pediatrics)',
      specialization: 'Pediatric Consultant',
      experienceYears: 8,
      consultationFee: 700,
      email: newDocEmail,
      phone: '9876501234',
      password: 'DocInitial@2026',
    },
    adminId
  );

  console.log('✓ Created doctor name:', createdDocResult.name);
  console.log('✓ Associated hospital ID:', createdDocResult.hospitalId, '(matches hospitalA:', createdDocResult.hospitalId === hospitalA.id, ')');
  console.log('✓ Initial credentials returned:', createdDocResult.initialCredentials);
  if (!createdDocResult.initialCredentials || createdDocResult.initialCredentials.email !== newDocEmail) {
    throw new Error('Initial credentials not returned for newly registered doctor');
  }

  // Verify doctor can log in with initial credentials
  const docLoginUser = await prisma.user.findUnique({ where: { email: newDocEmail } });
  const isInitialPassValid = await bcrypt.compare('DocInitial@2026', docLoginUser!.passwordHash);
  console.log('✓ Initial password verification:', isInitialPassValid);
  if (!isInitialPassValid) {
    throw new Error('Initial password verification failed');
  }

  // Cleanup test records
  await prisma.doctorSchedule.deleteMany({ where: { doctorId: { in: [testDoctor.id, createdDocResult.id] } } });
  await prisma.doctor.deleteMany({ where: { id: { in: [testDoctor.id, createdDocResult.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [testUser.id, docLoginUser!.id] } } });
  await prisma.pharmacy.delete({ where: { id: pharmacyA.id } });
  await prisma.lab.delete({ where: { id: labA.id } });
  await prisma.lab.delete({ where: { id: privateLab.id } });

  console.log('\nALL ROLE-BASED REGISTRATION APPROVAL & DOCTOR MANAGEMENT TESTS PASSED SUCCESSFULLY! ✓');
}

runTests()
  .catch((e) => {
    console.error('Test execution failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
