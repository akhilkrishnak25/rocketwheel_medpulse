import prisma from '../config/prisma';
import { DoctorDashboardService } from '../services/doctorDashboard.service';
import { labTestTemplateSchema } from '../validators/schemas';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runLabTemplatesTest() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING LAB TEST TEMPLATE SUITE (DISEASE-BASED)');
  console.log('======================================================\n');

  // 1. Setup test doctors and hospital
  let hospital = await prisma.hospital.findFirst();
  if (!hospital) {
    hospital = await prisma.hospital.create({
      data: {
        name: 'MedPulse Testing Hospital',
        code: 'MPH-TEST',
        address: '100 Medical Center Drive',
        city: 'Metropolis',
        state: 'NY',
        phone: '1800123456',
        email: 'testing@medpulse.com',
      },
    });
  }

  let department = await prisma.department.findFirst({ where: { hospitalId: hospital.id } });
  if (!department) {
    department = await prisma.department.create({
      data: {
        hospitalId: hospital.id,
        name: 'General Medicine',
        code: 'GENMED',
      },
    });
  }

  // Doctor A
  const docAUser = await prisma.user.create({
    data: {
      name: 'Dr. Alice Sharma',
      email: `doctor_a_${Date.now()}@medpulse.com`,
      passwordHash: 'dummyhash',
      role: 'DOCTOR',
    },
  });
  const doctorA = await prisma.doctor.create({
    data: {
      userId: docAUser.id,
      hospitalId: hospital.id,
      departmentId: department.id,
      name: 'Dr. Alice Sharma',
      qualification: 'MBBS, MD (Medicine)',
      specialization: 'Internal Medicine',
      languages: 'English, Hindi',
      about: 'Senior Consultant Physician',
      workingDays: 'Mon,Tue,Wed,Thu,Fri,Sat',
    },
  });

  // Doctor B
  const docBUser = await prisma.user.create({
    data: {
      name: 'Dr. Bob Verma',
      email: `doctor_b_${Date.now()}@medpulse.com`,
      passwordHash: 'dummyhash',
      role: 'DOCTOR',
    },
  });
  const doctorB = await prisma.doctor.create({
    data: {
      userId: docBUser.id,
      hospitalId: hospital.id,
      departmentId: department.id,
      name: 'Dr. Bob Verma',
      qualification: 'MBBS, MS',
      specialization: 'General Surgery',
      languages: 'English, Hindi',
      about: 'Consultant Surgeon',
      workingDays: 'Mon,Tue,Wed,Thu,Fri,Sat',
    },
  });

  console.log(`Created test doctors: Dr. Alice (${doctorA.id}) and Dr. Bob (${doctorB.id})`);

  // TEST 1: Schema validation
  console.log('\n--- Test 1: Validation with labTestTemplateSchema ---');
  const validPayload = {
    diseaseName: 'Dengue Fever Workup',
    description: 'Diagnostic panel for suspected dengue viral fever and thrombocytopenia',
    labTests: [
      { name: 'Dengue NS1 Antigen', category: 'Serology', price: 650, notes: 'Day 1-5 of fever' },
      { name: 'Dengue IgM/IgG Antibody', category: 'Serology', price: 800, notes: 'Day 5+ of fever' },
      { name: 'Complete Blood Count (CBC) with Platelets', category: 'Hematology', price: 350, notes: 'Daily platelet monitoring' },
    ],
  };
  const parsed = labTestTemplateSchema.parse(validPayload);
  assert(parsed.diseaseName === 'Dengue Fever Workup', 'Valid payload passed schema parse');
  assert(parsed.labTests.length === 3, 'Valid payload has 3 tests');

  let schemaFailed = false;
  try {
    labTestTemplateSchema.parse({ diseaseName: 'A', labTests: [] });
  } catch {
    schemaFailed = true;
  }
  assert(schemaFailed, 'Schema correctly rejects empty test array and short disease name');

  // TEST 2: Create Lab Test Template for Doctor A
  console.log('\n--- Test 2: Create Lab Test Template in Database ---');
  const tmpl1 = await DoctorDashboardService.createLabTestTemplate(
    doctorA.id,
    validPayload,
    docAUser.id
  );
  assert(tmpl1.id !== undefined, 'Lab test template 1 created successfully with ID');
  assert(tmpl1.diseaseName === 'Dengue Fever Workup', 'Disease name stored properly');
  assert(tmpl1.labTestsList.length === 3, 'labTestsList correctly parsed from JSON');
  assert(tmpl1.labTestsList[0].name === 'Dengue NS1 Antigen', 'Test 1 matches payload');

  // Create second template for Doctor A (Diabetic Nephropathy)
  const tmpl2 = await DoctorDashboardService.createLabTestTemplate(
    doctorA.id,
    {
      diseaseName: 'Type 2 Diabetes Screening & Renal Profile',
      description: 'Annual glycemic and renal assessment panel',
      labTests: [
        { name: 'Fasting Blood Sugar (FBS)', category: 'Biochemistry', price: 80, notes: '10-12 hours fasting' },
        { name: 'HbA1c Glycated Hemoglobin', category: 'Biochemistry', price: 500, notes: 'Quarterly review' },
        { name: 'Serum Creatinine', category: 'Biochemistry', price: 160 },
        { name: 'Urine Microalbumin/Creatinine Ratio', category: 'Pathology', price: 420, notes: 'Early morning urine' },
      ],
    },
    docAUser.id
  );
  assert(tmpl2.id !== undefined, 'Lab test template 2 created successfully');
  assert(tmpl2.labTestsList.length === 4, 'Template 2 has 4 tests');

  // TEST 3: Retrieve Lab Test Templates for Doctor A
  console.log('\n--- Test 3: Retrieve Doctor Templates ---');
  const doctorATemplates = await DoctorDashboardService.getLabTestTemplates(doctorA.id);
  assert(doctorATemplates.length === 2, `Doctor A has 2 templates (received ${doctorATemplates.length})`);

  // TEST 4: Search templates by disease name and test name
  console.log('\n--- Test 4: Search Templates ---');
  const searchDengue = await DoctorDashboardService.getLabTestTemplates(doctorA.id, 'Dengue');
  assert(searchDengue.length === 1 && searchDengue[0].diseaseName.includes('Dengue'), 'Search by disease name "Dengue" returns 1 result');

  const searchMicroalbumin = await DoctorDashboardService.getLabTestTemplates(doctorA.id, 'Microalbumin');
  assert(searchMicroalbumin.length === 1 && searchMicroalbumin[0].diseaseName.includes('Diabetes'), 'Search by test name "Microalbumin" finds Diabetes template');

  // TEST 5: Doctor B Isolation (Zero cross-contamination)
  console.log('\n--- Test 5: Role-based isolation between doctors ---');
  const doctorBTemplates = await DoctorDashboardService.getLabTestTemplates(doctorB.id);
  assert(doctorBTemplates.length === 0, 'Doctor B sees 0 templates (no cross-contamination from Doctor A)');

  let unauthorizedUpdate = false;
  try {
    await DoctorDashboardService.updateLabTestTemplate(doctorB.id, tmpl1.id, { diseaseName: 'Hacked Name' });
  } catch {
    unauthorizedUpdate = true;
  }
  assert(unauthorizedUpdate, 'Doctor B cannot update Doctor A\'s lab template');

  let unauthorizedDelete = false;
  try {
    await DoctorDashboardService.deleteLabTestTemplate(doctorB.id, tmpl1.id);
  } catch {
    unauthorizedDelete = true;
  }
  assert(unauthorizedDelete, 'Doctor B cannot delete Doctor A\'s lab template');

  // TEST 6: Update Lab Test Template
  console.log('\n--- Test 6: Update Lab Test Template ---');
  const updatedTmpl = await DoctorDashboardService.updateLabTestTemplate(
    doctorA.id,
    tmpl1.id,
    {
      diseaseName: 'Dengue & Arboviral Acute Workup',
      description: 'Updated clinical indication notes',
      labTests: [
        ...tmpl1.labTestsList,
        { name: 'Liver Function Test (SGOT/SGPT)', category: 'Biochemistry', price: 400, notes: 'Assess transaminitis' },
      ],
    },
    docAUser.id
  );
  assert(updatedTmpl.diseaseName === 'Dengue & Arboviral Acute Workup', 'Disease name updated successfully');
  assert(updatedTmpl.labTestsList.length === 4, 'Added 4th test to template (LFT)');
  assert(updatedTmpl.description === 'Updated clinical indication notes', 'Description updated');

  // TEST 7: Delete Lab Test Template
  console.log('\n--- Test 7: Delete Lab Test Template ---');
  const deleteResult = await DoctorDashboardService.deleteLabTestTemplate(doctorA.id, tmpl2.id, docAUser.id);
  assert(deleteResult.success === true, 'Template 2 deleted successfully');

  const remaining = await DoctorDashboardService.getLabTestTemplates(doctorA.id);
  assert(remaining.length === 1, 'Doctor A now has exactly 1 template remaining');
  assert(remaining[0].id === tmpl1.id, 'Remaining template is template 1');

  // Clean up test users & records
  await prisma.labTestTemplate.deleteMany({ where: { doctorId: doctorA.id } });
  await prisma.doctor.deleteMany({ where: { id: { in: [doctorA.id, doctorB.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [docAUser.id, docBUser.id] } } });

  console.log('\n======================================================');
  console.log('🎉 ALL LAB TEST TEMPLATE ACCEPTANCE TESTS PASSED (100%)');
  console.log('======================================================\n');
}

runLabTemplatesTest()
  .catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
