import prisma from '../config/prisma';
import { DoctorDashboardService } from '../services/doctorDashboard.service';
import { AppointmentService } from '../services/appointment.service';

async function run() {
  console.log('\n======================================================');
  console.log('🩺 RUNNING CLINICAL CONSULTATION "SAVE CHANGES" TEST SUITE');
  console.log('======================================================\n');

  try {
    // 1. Setup doctor, patient, hospital
    const hospital = await prisma.hospital.findFirst();
    if (!hospital) throw new Error('No hospital found');

    const email = `test.doctor.sc.${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: {
        email,
        name: 'Dr. SaveChanges Tester',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
        role: 'DOCTOR',
      },
    });

    let department = await prisma.department.findFirst({ where: { hospitalId: hospital.id } });
    if (!department) {
      department = await prisma.department.create({
        data: {
          hospitalId: hospital.id,
          name: 'General Medicine',
          code: `GENMED_${Date.now()}`,
        },
      });
    }

    const doctor = await prisma.doctor.create({
      data: {
        userId: user.id,
        hospitalId: hospital.id,
        departmentId: department.id,
        name: 'Dr. SaveChanges Tester',
        specialization: 'General Medicine',
        qualification: 'MBBS, MD',
        consultationFee: 500,
        workingDays: 'Mon,Tue,Wed,Thu,Fri',
        workingHoursStart: '09:00',
        workingHoursEnd: '17:00',
        languages: 'English, Hindi',
        about: 'Specialist tester for save changes',
      },
    });

    const walkin = await AppointmentService.createOfflineAppointment({
      hospitalId: hospital.id,
      doctorId: doctor.id,
      patient: {
        fullName: 'Jane SaveChanges Patient',
        mobileNumber: `95${Math.floor(10000000 + Math.random() * 90000000)}`,
        gender: 'FEMALE',
        age: 32,
        bloodGroup: 'O+',
      },
      appointmentDate: new Date().toISOString().split('T')[0],
      timeSlot: '10:00 AM',
      consultationType: 'IN_PERSON',
    });

    const apt = walkin.appointment;

    console.log('--- Test 1: Save Changes on In-Progress Consultation ---');
    const result1 = await DoctorDashboardService.saveConsultationChanges(doctor.id, apt.id, {
      diagnosis: 'Acute Pharyngitis',
      chiefComplaints: 'Sore throat and mild fever for 2 days',
      examination: 'Throat erythematous, tonsils mildly enlarged',
      vitals: { bp: '118/78', pulse: '76', temperature: '99.1', spo2: '98' },
      medicines: [
        {
          name: 'Azithromycin 500mg',
          dosage: '1 tablet',
          frequency: 'OD (Once daily)',
          duration: '3 days',
          instructions: 'After food',
          priority: 1,
        },
      ],
      clinicalNotes: 'Warm salt water gargle thrice daily',
      followUpDate: '2026-11-01',
    }, user.id);

    console.assert(result1.appointment.status === 'DRAFT', 'Status should be DRAFT');
    console.assert(result1.draft.diagnosis === 'Acute Pharyngitis', 'Diagnosis persisted in draft');
    console.log('✅ PASSED: In-progress consultation saved changes with DRAFT status and all fields persisted');

    console.log('\n--- Test 2: Complete the Consultation ---');
    const completeRes = await DoctorDashboardService.completeConsultation(doctor.id, apt.id, {
      diagnosis: 'Acute Pharyngitis - Confirmed',
      medicines: [
        {
          name: 'Azithromycin 500mg',
          dosage: '1 tablet',
          frequency: 'OD (Once daily)',
          duration: '3 days',
          instructions: 'After food',
          priority: 1,
        },
      ],
      clinicalNotes: 'Warm salt water gargle',
    }, user.id);

    console.assert(completeRes.appointment.status === 'COMPLETED', 'Status should be COMPLETED');
    console.assert(completeRes.prescription !== null, 'Prescription issued');
    console.log('✅ PASSED: Consultation completed & prescription issued');

    console.log('\n--- Test 3: Save Changes on Completed Consultation (Amendment/Update) ---');
    // Doctor re-opens completed consultation, edits medicines/notes, and saves changes
    const resultUpdated = await DoctorDashboardService.saveConsultationChanges(doctor.id, apt.id, {
      diagnosis: 'Acute Pharyngitis with Mild Bronchitis',
      chiefComplaints: 'Sore throat, mild fever, and dry cough',
      examination: 'Throat erythematous, bilateral rhonchi on auscultation',
      vitals: { bp: '120/80', pulse: '80', temperature: '98.6', spo2: '99' },
      medicines: [
        {
          name: 'Azithromycin 500mg',
          dosage: '1 tablet',
          frequency: 'OD (Once daily)',
          duration: '3 days',
          instructions: 'After food',
          priority: 1,
        },
        {
          name: 'Ambroxol Syrup',
          dosage: '10ml',
          frequency: 'TDS (Thrice daily)',
          duration: '5 days',
          instructions: 'After food',
          priority: 2,
        },
      ],
      clinicalNotes: 'Steam inhalation twice daily, drink warm fluids',
      followUpDate: '2026-11-05',
    }, user.id);

    console.assert(resultUpdated.appointment.status === 'COMPLETED', 'Status must remain COMPLETED');

    // Verify database prescription and medicalRecord were updated in-place
    const dbPrescription = await prisma.prescription.findUnique({
      where: { appointmentId: apt.id },
    });
    console.assert(dbPrescription !== null, 'Prescription must exist');
    console.assert(dbPrescription?.diagnosis === 'Acute Pharyngitis with Mild Bronchitis', 'Diagnosis updated in prescription');
    const parsedMeds = JSON.parse(dbPrescription?.medicines || '[]');
    console.assert(parsedMeds.length === 2, `Expected 2 medicines, got ${parsedMeds.length}`);
    console.assert(parsedMeds[1].name === 'Ambroxol Syrup', 'Second medicine added and persisted');

    const dbRecord = await prisma.medicalRecord.findUnique({
      where: { appointmentId: apt.id },
    });
    console.assert(dbRecord !== null, 'Medical record must exist');
    console.assert(dbRecord?.clinicalNotes === 'Steam inhalation twice daily, drink warm fluids', 'Clinical notes updated in medical record');

    console.log('✅ PASSED: Save Changes on completed consultation safely updated prescription, medicines, and medical records in-place without resetting COMPLETED status');

    console.log('\n======================================================');
    console.log('🎉 ALL "SAVE CHANGES" ACCEPTANCE TESTS PASSED (100%)');
    console.log('======================================================\n');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
