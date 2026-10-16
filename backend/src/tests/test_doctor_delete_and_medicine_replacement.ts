import prisma from '../config/prisma';
import { AdminService } from '../services/admin.service';
import { PharmacyService } from '../services/pharmacy.service';

async function runTests() {
  console.log('=== STARTING DOCTOR DELETION & PHARMACY MEDICINE REPLACEMENT TESTS ===\n');

  try {
    // 1. Setup Test Hospitals & Departments
    let hospitalA = await prisma.hospital.findFirst({ where: { slug: 'test-hosp-del-a' } });
    if (!hospitalA) {
      hospitalA = await prisma.hospital.create({
        data: {
          name: 'Apex Super Specialty Hospital A',
          slug: 'test-hosp-del-a',
          code: 'APEX-A',
          address: 'Block A, Medical Enclave',
          city: 'Hyderabad',
          state: 'Telangana',
          pincode: '500001',
          phone: '040-11112222',
          email: 'admin@apexhosp-a.com',
          emergencyContact: '108',
          openingHours: '24/7',
          about: 'Test tertiary hospital A',
          facilities: 'OPD, Inpatient, Diagnostics, Pharmacy',
        },
      });
    }

    let hospitalB = await prisma.hospital.findFirst({ where: { slug: 'test-hosp-del-b' } });
    if (!hospitalB) {
      hospitalB = await prisma.hospital.create({
        data: {
          name: 'Apex Super Specialty Hospital B',
          slug: 'test-hosp-del-b',
          code: 'APEX-B',
          address: 'Block B, Health City',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
          phone: '080-33334444',
          email: 'admin@apexhosp-b.com',
          emergencyContact: '108',
          openingHours: '24/7',
          about: 'Test tertiary hospital B',
          facilities: 'OPD, Inpatient, Diagnostics, Pharmacy',
        },
      });
    }

    let deptA = await prisma.department.findFirst({ where: { hospitalId: hospitalA.id } });
    if (!deptA) {
      deptA = await prisma.department.create({
        data: {
          hospitalId: hospitalA.id,
          name: 'General Internal Medicine',
          slug: 'internal-medicine-a',
          code: 'MED-A',
        },
      });
    }

    let deptB = await prisma.department.findFirst({ where: { hospitalId: hospitalB.id } });
    if (!deptB) {
      deptB = await prisma.department.create({
        data: {
          hospitalId: hospitalB.id,
          name: 'Cardiology',
          slug: 'cardiology-b',
          code: 'CARD-B',
        },
      });
    }

    console.log('✓ Test Hospitals & Departments ready');

    // -------------------------------------------------------------
    // TEST SUITE 1: DOCTOR DELETION WORKFLOW
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 1: Doctor Deletion & Isolation ---');

    // 1.1 Add Doctor 1 under Hospital A
    const doc1 = await AdminService.addDoctor(hospitalA.id, {
      name: 'Dr. Ramesh Kumar',
      email: `ramesh.kumar.${Date.now()}@test.com`,
      departmentId: deptA.id,
      qualification: 'MBBS, MD',
      specialization: 'Internal Medicine',
      experienceYears: 10,
      consultationFee: 600,
    });
    console.log(`✓ Doctor 1 registered in Hospital A: Dr. ${doc1.name} (ID: ${doc1.id})`);

    // 1.2 Add Doctor 2 under Hospital B
    const doc2 = await AdminService.addDoctor(hospitalB.id, {
      name: 'Dr. Sneha Rao',
      email: `sneha.rao.${Date.now()}@test.com`,
      departmentId: deptB.id,
      qualification: 'MBBS, DM Cardiology',
      specialization: 'Cardiology',
      experienceYears: 8,
      consultationFee: 800,
    });
    console.log(`✓ Doctor 2 registered in Hospital B: Dr. ${doc2.name} (ID: ${doc2.id})`);

    // 1.3 Cross-Hospital Authorization Check:
    // Hospital Admin A MUST NOT be able to delete Doctor 2 from Hospital B
    let crossDeleteBlocked = false;
    try {
      await AdminService.deleteDoctor(hospitalA.id, doc2.id);
    } catch (err: any) {
      crossDeleteBlocked = true;
      console.log(`✓ Cross-hospital deletion properly rejected: "${err.message}"`);
    }
    if (!crossDeleteBlocked) {
      throw new Error('FAIL: Hospital A was able to delete Doctor belonging to Hospital B!');
    }

    // 1.4 Fresh Doctor Clean Deletion (No appointments/prescriptions)
    const deleteFreshResult = await AdminService.deleteDoctor(hospitalA.id, doc1.id);
    console.log(`✓ Fresh doctor deleted: ${deleteFreshResult.message} (softDeleted: ${deleteFreshResult.softDeleted})`);
    const doc1Check = await prisma.doctor.findUnique({ where: { id: doc1.id } });
    if (doc1Check) {
      throw new Error('FAIL: Fresh doctor record was not deleted');
    }

    // 1.5 Soft Deletion when historical clinical records exist
    // Re-create a doctor with an appointment & prescription
    const docWithHistory = await AdminService.addDoctor(hospitalA.id, {
      name: 'Dr. Anita Sharma',
      email: `anita.sharma.${Date.now()}@test.com`,
      departmentId: deptA.id,
      qualification: 'MBBS, DNB',
      specialization: 'General Medicine',
      experienceYears: 12,
      consultationFee: 500,
    });

    // Create a patient and appointment
    let patient = await prisma.patient.findFirst({ where: { hospitalId: hospitalA.id } });
    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          hospitalId: hospitalA.id,
          fullName: 'Test Patient Rajesh',
          email: `rajesh.${Date.now()}@test.com`,
          mobileNumber: '9876543210',
          patientIdNumber: `MRN-${Date.now()}`,
          gender: 'MALE',
          age: 42,
        },
      });
    }

    const apt = await prisma.appointment.create({
      data: {
        hospitalId: hospitalA.id,
        doctorId: docWithHistory.id,
        departmentId: deptA.id,
        patientId: patient.id,
        appointmentNumber: `APT-DEL-${Date.now()}`,
        appointmentDate: '2026-10-17',
        timeSlot: '10:00 - 10:30',
        tokenNumber: 5,
        status: 'COMPLETED',
        consultationFee: 500,
        totalAmount: 500,
      },
    });

    // Create prescription for this doctor & appointment
    const initialMedicines = [
      { name: 'Augmentin 625mg', dosage: '1 tablet', frequency: '1-0-1', duration: '5 days', instructions: 'After food' },
      { name: 'Paracetamol 650mg', dosage: '1 tablet', frequency: '1-1-1', duration: '3 days', instructions: 'After food' },
    ];

    const rx = await prisma.prescription.create({
      data: {
        appointmentId: apt.id,
        doctorId: docWithHistory.id,
        patientId: patient.id,
        hospitalId: hospitalA.id,
        diagnosis: 'Acute Upper Respiratory Tract Infection',
        medicines: JSON.stringify(initialMedicines),
        instructions: 'Drink plenty of warm fluids and take rest.',
        pharmacyStatus: 'SENT',
      },
    });

    console.log(`✓ Doctor with clinical history created: Dr. ${docWithHistory.name} with Appointment #${apt.appointmentNumber}`);

    // Now delete docWithHistory
    const deleteHistoryResult = await AdminService.deleteDoctor(hospitalA.id, docWithHistory.id);
    console.log(`✓ Doctor deletion completed: ${deleteHistoryResult.message} (softDeleted: ${deleteHistoryResult.softDeleted})`);
    if (!deleteHistoryResult.softDeleted) {
      throw new Error('FAIL: Doctor with appointments was not soft-deleted!');
    }

    // Verify doctor record is marked DELETED and inactive
    const softDeletedDoc = await prisma.doctor.findUnique({ where: { id: docWithHistory.id } });
    if (!softDeletedDoc || softDeletedDoc.status !== 'DELETED' || softDeletedDoc.isActive !== false) {
      throw new Error('FAIL: Doctor was not properly marked DELETED and inactive');
    }

    // Verify associated user is DEACTIVATED preventing login
    if (docWithHistory.userId) {
      const userDoc = await prisma.user.findUnique({ where: { id: docWithHistory.userId } });
      if (!userDoc || userDoc.status !== 'DEACTIVATED' || userDoc.isActive !== false) {
        throw new Error('FAIL: Associated User account was not deactivated');
      }
      console.log('✓ Associated user account deactivated (login blocked)');
    }

    // Verify deleted doctor is excluded from getDoctors
    const activeDocsInHospitalA = await AdminService.getDoctors(hospitalA.id);
    const foundDeletedInActiveList = activeDocsInHospitalA.some((d) => d.id === docWithHistory.id);
    if (foundDeletedInActiveList) {
      throw new Error('FAIL: Deleted doctor is still appearing in AdminService.getDoctors list!');
    }
    console.log('✓ Deleted doctor successfully excluded from AdminService.getDoctors directory');

    // Verify historical prescription and appointment are intact
    const preservedApt = await prisma.appointment.findUnique({ where: { id: apt.id } });
    const preservedRx = await prisma.prescription.findUnique({ where: { id: rx.id } });
    if (!preservedApt || !preservedRx) {
      throw new Error('FAIL: Historical appointment or prescription was destroyed!');
    }
    console.log('✓ Historical clinical records (consultation & prescription) safely preserved');

    // -------------------------------------------------------------
    // TEST SUITE 2: PHARMACY MEDICINE REPLACEMENT WORKFLOW
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 2: Unavailable Medicine Replacement Workflow ---');

    // 2.1 Fetch prescription queue in Pharmacy
    const pharmacyPrescriptions = await PharmacyService.getPrescriptions(undefined, hospitalA.id);
    const targetRxInQueue = pharmacyPrescriptions.find((p) => p.id === rx.id);
    if (!targetRxInQueue) {
      throw new Error('FAIL: Prescription not visible in Pharmacy queue');
    }
    console.log(`✓ Prescription found in Pharmacy Queue: ID ${rx.id}`);
    console.log(`  Original Medicines (${targetRxInQueue.medicinesList.length}):`);
    targetRxInQueue.medicinesList.forEach((m: any, i: number) => {
      console.log(`    ${i + 1}. ${m.name} - ${m.dosage} - ${m.frequency} - ${m.duration}`);
    });

    // 2.2 Pharmacy discovers "Augmentin 625mg" is out of stock / unavailable.
    // Replace medicine at index 0 with equivalent generic "Amoxyclav 625mg Tablet (Generic Equiv)"
    console.log('\n  Performing Pharmacy Medicine Replacement:');
    const replacementData = {
      medicineIndex: 0,
      originalName: 'Augmentin 625mg',
      replacement: {
        name: 'Amoxyclav 625mg Tablet (Generic Equiv)',
        dosage: '1 tablet',
        frequency: '1-0-1',
        duration: '5 days',
        instructions: 'After meals with water',
        strength: '625mg',
        formulation: 'Tablet',
      },
      reason: 'Augmentin 625mg out of stock; substituted equivalent bio-equivalent Amoxyclav formulation',
      doctorApproved: true,
    };

    const replaceResult = await PharmacyService.replaceMedicine(
      rx.id,
      undefined,
      replacementData,
      'pharm-staff-user-123',
      'Chief Pharmacist Suresh'
    );

    console.log('✓ Pharmacy medicine replacement executed');
    const updatedMeds = replaceResult.medicinesList;
    const replacedItem = updatedMeds[0];

    // Verify replaced item fields
    if (replacedItem.name !== 'Amoxyclav 625mg Tablet (Generic Equiv)') {
      throw new Error(`FAIL: Replacement medicine name mismatch: ${replacedItem.name}`);
    }
    if (!replacedItem.isSubstituted) {
      throw new Error('FAIL: isSubstituted flag not set on replaced medicine');
    }
    if (replacedItem.originalMedicine !== 'Augmentin 625mg') {
      throw new Error(`FAIL: Original medicine name not preserved: ${replacedItem.originalMedicine}`);
    }
    if (!replacedItem.substitutionReason) {
      throw new Error('FAIL: Substitution reason was not stored');
    }
    console.log(`✓ Replacement details captured:`);
    console.log(`    Substituted Name: ${replacedItem.name}`);
    console.log(`    Original Prescribed Name: ${replacedItem.originalMedicine}`);
    console.log(`    Substitution Reason: ${replacedItem.substitutionReason}`);
    console.log(`    Substituted By: ${replacedItem.substitutedBy} at ${replacedItem.substitutedAt}`);

    // Verify other prescribed medicine ("Paracetamol 650mg") and diagnosis are completely untouched
    const untouchedMed = updatedMeds[1];
    if (untouchedMed.name !== 'Paracetamol 650mg' || untouchedMed.isSubstituted) {
      throw new Error('FAIL: Unrelated prescribed medicine was modified!');
    }
    const freshRxCheck = await prisma.prescription.findUnique({ where: { id: rx.id } });
    if (freshRxCheck?.diagnosis !== 'Acute Upper Respiratory Tract Infection') {
      throw new Error('FAIL: Doctor diagnosis was altered during medicine replacement!');
    }
    console.log('✓ Unrelated medicines and doctor provisional diagnosis preserved intact');

    // 2.3 Verify Revised Prescription PDF Generation
    console.log('\n  Generating Revised Prescription PDF...');
    const pdfBuffer = await PharmacyService.generatePrescriptionPdf(rx.id);
    if (!pdfBuffer || pdfBuffer.length < 100) {
      throw new Error('FAIL: Revised prescription PDF generation returned empty buffer');
    }
    console.log(`✓ Revised Prescription PDF generated successfully (${pdfBuffer.length} bytes)`);

    // 2.4 Transition Pharmacy Dispensing Status to COMPLETED
    const dispenseResult = await PharmacyService.updateStatus(
      rx.id,
      undefined,
      'COMPLETED',
      'pharm-staff-user-123',
      'Chief Pharmacist Suresh'
    );
    if (dispenseResult.pharmacyStatus !== 'COMPLETED' || !dispenseResult.dispensedAt) {
      throw new Error('FAIL: Dispensing completion status not set');
    }
    console.log(`✓ Prescription order dispensed to patient by ${dispenseResult.dispensedBy}`);

    console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===\n');
  } catch (err) {
    console.error('TEST FAILED:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
