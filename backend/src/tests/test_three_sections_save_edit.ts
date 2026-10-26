import prisma from '../config/prisma';
import { DoctorDashboardService } from '../services/doctorDashboard.service';
import { AppointmentService } from '../services/appointment.service';
import bcrypt from 'bcryptjs';

async function runTest() {
  console.log('🚀 Running Test: Independent Save & Edit for Vitals, Complaints, Examination, plus Lab Templates...');
  const testRunId = `sec_${Date.now()}`;

  try {
    // 1. Setup hospital, department, doctor, and patient
    let hospital = await prisma.hospital.findFirst();
    if (!hospital) {
      hospital = await prisma.hospital.create({
        data: {
          name: `Test Hospital ${testRunId}`,
          code: `HOSP_${Date.now().toString().slice(-4)}`,
          address: '123 Main Street',
          city: 'City',
          state: 'State',
          pincode: '600001',
          phone: '9876543210',
          email: `hosp_${testRunId}@example.com`,
        },
      });
    }

    let department = await prisma.department.findFirst({ where: { hospitalId: hospital.id } });
    if (!department) {
      department = await prisma.department.create({
        data: {
          name: `Cardiology ${testRunId}`,
          code: `CARD_${Date.now().toString().slice(-4)}`,
          hospitalId: hospital.id,
        },
      });
    }

    const hashedPassword = await bcrypt.hash('Password@123', 10);
    const doctorUser = await prisma.user.create({
      data: {
        name: `Dr. Smith ${testRunId}`,
        email: `dr_${testRunId}@hospital.com`,
        passwordHash: hashedPassword,
        role: 'DOCTOR',
      },
    });

    const doctor = await prisma.doctor.create({
      data: {
        userId: doctorUser.id,
        hospitalId: hospital.id,
        departmentId: department.id,
        name: `Dr. Smith ${testRunId}`,
        qualification: 'MBBS, MD',
        specialization: 'Cardiology',
        languages: 'English, Hindi',
        about: 'Senior Consultant Physician',
        workingDays: 'Mon,Tue,Wed,Thu,Fri,Sat',
      },
    });

    // Create 2 distinct offline appointments (OPs)
    const walkin1 = await AppointmentService.createOfflineAppointment({
      hospitalId: hospital.id,
      doctorId: doctor.id,
      patient: {
        fullName: `Patient Alpha ${testRunId}`,
        age: 35,
        gender: 'MALE',
        mobileNumber: `91${Math.floor(10000000 + Math.random() * 90000000)}`,
        bloodGroup: 'B+',
      },
      appointmentDate: new Date().toISOString().split('T')[0],
      timeSlot: '09:00 AM',
      consultationType: 'IN_PERSON',
    });
    const op1 = walkin1.appointment;

    const walkin2 = await AppointmentService.createOfflineAppointment({
      hospitalId: hospital.id,
      doctorId: doctor.id,
      patient: {
        fullName: `Patient Beta ${testRunId}`,
        age: 42,
        gender: 'FEMALE',
        mobileNumber: `92${Math.floor(10000000 + Math.random() * 90000000)}`,
        bloodGroup: 'O+',
      },
      appointmentDate: new Date().toISOString().split('T')[0],
      timeSlot: '09:30 AM',
      consultationType: 'IN_PERSON',
    });
    const op2 = walkin2.appointment;

    console.log(`✓ Created test OPs: OP1=${op1.id}, OP2=${op2.id}`);

    // Test 1: Save Chief Complaints independently on OP 1
    console.log('\n--- Test 1: Independent Save of Chief Complaints (OP1) ---');
    const complaintsPayload = {
      chiefComplaints: 'High fever for 3 days with intense headache and body aches',
      symptoms: 'High fever for 3 days with intense headache and body aches',
    };
    await DoctorDashboardService.saveConsultationDraft(doctor.id, op1.id, complaintsPayload, doctorUser.id);

    let details1 = await DoctorDashboardService.getConsultationDetails(doctor.id, op1.id);
    if (details1.draft?.chiefComplaints !== complaintsPayload.chiefComplaints) {
      throw new Error(`Test 1 Failed: Expected chiefComplaints to be persisted. Got: ${details1.draft?.chiefComplaints}`);
    }
    if (details1.appointment?.status === 'COMPLETED') {
      throw new Error('Test 1 Failed: Consultation must NOT be marked completed when saving Chief Complaints.');
    }
    console.log('✓ Chief Complaints saved independently. Consultation status remains in-progress/waiting.');

    // Test 2: Save Consultation Vitals independently on OP 1
    console.log('\n--- Test 2: Independent Save of Consultation Vitals (OP1) ---');
    const vitalsPayload = {
      vitals: {
        bp: '128/84 mmHg',
        pulse: '78 bpm',
        temperature: '101.2 F',
        weight: '68 kg',
        spo2: '98%',
      },
    };
    await DoctorDashboardService.saveConsultationDraft(doctor.id, op1.id, vitalsPayload, doctorUser.id);

    details1 = await DoctorDashboardService.getConsultationDetails(doctor.id, op1.id);
    const parsedVitals1 = typeof details1.draft?.vitals === 'string' ? JSON.parse(details1.draft.vitals) : details1.draft?.vitals;
    if (parsedVitals1?.bp !== '128/84 mmHg' || parsedVitals1?.temperature !== '101.2 F') {
      throw new Error(`Test 2 Failed: Vitals not persisted correctly. Got: ${JSON.stringify(parsedVitals1)}`);
    }
    // Verify Chief Complaints were preserved and not wiped out by the vitals save
    if (details1.draft?.chiefComplaints !== complaintsPayload.chiefComplaints) {
      throw new Error(`Test 2 Failed: Chief complaints wiped out after vitals save! Got: ${details1.draft?.chiefComplaints}`);
    }
    console.log('✓ Consultation Vitals saved independently. Chief complaints preserved cleanly.');

    // Test 3: Save Examination independently on OP 1
    console.log('\n--- Test 3: Independent Save of Examinations (OP1) ---');
    const examPayload = {
      examination: 'CVS: S1 S2 heard no murmurs. RS: Bilateral vesicular breath sounds. P/A: Soft non-tender.',
    };
    await DoctorDashboardService.saveConsultationDraft(doctor.id, op1.id, examPayload, doctorUser.id);

    details1 = await DoctorDashboardService.getConsultationDetails(doctor.id, op1.id);
    if (details1.draft?.examination !== examPayload.examination) {
      throw new Error(`Test 3 Failed: Examination not saved. Got: ${details1.draft?.examination}`);
    }
    if (details1.draft?.chiefComplaints !== complaintsPayload.chiefComplaints) {
      throw new Error('Test 3 Failed: Chief complaints wiped out after examination save.');
    }
    const parsedVitalsAfterExam = typeof details1.draft?.vitals === 'string' ? JSON.parse(details1.draft.vitals) : details1.draft?.vitals;
    if (parsedVitalsAfterExam?.bp !== '128/84 mmHg') {
      throw new Error('Test 3 Failed: Vitals wiped out after examination save.');
    }
    console.log('✓ Examination saved independently. All prior sections remain intact.');

    // Test 4: Edit & Update Chief Complaints on OP 1 (Verify record updated, no duplicates)
    console.log('\n--- Test 4: Edit & Update Chief Complaints without duplicates (OP1) ---');
    const updatedComplaintsPayload = {
      chiefComplaints: 'High fever for 3 days, headache, AND mild dry cough developing today',
      symptoms: 'High fever for 3 days, headache, AND mild dry cough developing today',
    };
    await DoctorDashboardService.saveConsultationDraft(doctor.id, op1.id, updatedComplaintsPayload, doctorUser.id);

    details1 = await DoctorDashboardService.getConsultationDetails(doctor.id, op1.id);
    if (details1.draft?.chiefComplaints !== updatedComplaintsPayload.chiefComplaints) {
      throw new Error(`Test 4 Failed: Updated complaints not reflected. Got: ${details1.draft?.chiefComplaints}`);
    }
    // Check database to ensure only one draft record exists for op1
    const draftCountOp1 = await prisma.consultationDraft.count({ where: { appointmentId: op1.id } });
    if (draftCountOp1 !== 1) {
      throw new Error(`Test 4 Failed: Expected exactly 1 draft record for OP1, found ${draftCountOp1}`);
    }
    console.log(`✓ Edited Chief Complaints updated in place without duplicate records (total drafts for OP1 = ${draftCountOp1}).`);

    // Test 5: OP-Wise Strict Isolation: Save completely different data for OP 2
    console.log('\n--- Test 5: Strict Isolation between OPs (OP1 vs OP2) ---');
    const op2Payload = {
      chiefComplaints: 'Severe epigastric pain radiating to back for 2 days after heavy meal',
      examination: 'P/A: Marked epigastric tenderness, voluntary guarding present, no rebound.',
      vitals: {
        bp: '144/92 mmHg',
        pulse: '96 bpm',
        temperature: '99.0 F',
        weight: '82 kg',
        spo2: '97%',
      },
    };
    await DoctorDashboardService.saveConsultationDraft(doctor.id, op2.id, op2Payload, doctorUser.id);

    // Retrieve both OP1 and OP2
    const freshOp1 = await DoctorDashboardService.getConsultationDetails(doctor.id, op1.id);
    const freshOp2 = await DoctorDashboardService.getConsultationDetails(doctor.id, op2.id);

    // Verify OP 1 retains its data
    if (freshOp1.draft?.chiefComplaints !== updatedComplaintsPayload.chiefComplaints) {
      throw new Error(`Test 5 Failed: OP1 chief complaints contaminated! Got: ${freshOp1.draft?.chiefComplaints}`);
    }
    if (freshOp1.draft?.examination !== examPayload.examination) {
      throw new Error(`Test 5 Failed: OP1 examination contaminated! Got: ${freshOp1.draft?.examination}`);
    }

    // Verify OP 2 has its own data
    if (freshOp2.draft?.chiefComplaints !== op2Payload.chiefComplaints) {
      throw new Error(`Test 5 Failed: OP2 chief complaints incorrect! Got: ${freshOp2.draft?.chiefComplaints}`);
    }
    if (freshOp2.draft?.examination !== op2Payload.examination) {
      throw new Error(`Test 5 Failed: OP2 examination incorrect! Got: ${freshOp2.draft?.examination}`);
    }
    const parsedV2 = typeof freshOp2.draft?.vitals === 'string' ? JSON.parse(freshOp2.draft.vitals) : freshOp2.draft?.vitals;
    if (parsedV2?.bp !== '144/92 mmHg') {
      throw new Error(`Test 5 Failed: OP2 vitals incorrect! Got: ${parsedV2?.bp}`);
    }

    console.log('✓ Strict OP-wise isolation verified! OP1 and OP2 maintain independent data without cross-contamination.');

    // Test 6: Lab Test Template creation and retrieval
    console.log('\n--- Test 6: Lab Test Template for a Disease ---');
    const labTemplate = await DoctorDashboardService.createLabTestTemplate(
      doctor.id,
      {
        diseaseName: `Dengue Fever Workup ${testRunId}`,
        description: 'Standard diagnostic protocol for suspected dengue viral fever',
        labTests: [
          { name: 'Complete Blood Count (CBC) with Platelets', code: 'CBC-PLT', category: 'Pathology', price: 400 },
          { name: 'Dengue NS1 Antigen (Rapid)', code: 'DENG-NS1', category: 'Serology', price: 650 },
          { name: 'Dengue IgM / IgG Antibodies', code: 'DENG-AB', category: 'Serology', price: 800 },
        ],
      },
      hospital.id
    );

    const savedTemplates = await DoctorDashboardService.getLabTestTemplates(doctor.id);
    const foundTmpl = savedTemplates.find((t: any) => t.id === labTemplate.id);
    if (!foundTmpl) {
      throw new Error('Test 6 Failed: Saved lab template not found in doctor templates list.');
    }
    const tmplTests = foundTmpl.labTestsList || (typeof foundTmpl.labTests === 'string' ? JSON.parse(foundTmpl.labTests) : foundTmpl.labTests);
    if (tmplTests.length !== 3) {
      throw new Error(`Test 6 Failed: Expected 3 tests in lab template, found ${tmplTests.length}`);
    }
    console.log(`✓ Lab test template created and verified successfully for "${foundTmpl.diseaseName}" with ${tmplTests.length} tests.`);

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! ✅');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
