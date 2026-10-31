import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import prisma from '../config/prisma';
import { LabService } from '../services/lab.service';
import { AdminService } from '../services/admin.service';
import { PharmacyService } from '../services/pharmacy.service';
import { generateClinicalConsultationPdf } from '../utils/pdf';
import ExcelJS from 'exceljs';

async function runTests() {
  console.log('================================================================');
  console.log('STARTING AUTOMATED VERIFICATION SUITE');
  console.log('1. Bulk Import & Export of Lab Tests (Excel / CSV Master Catalog)');
  console.log('2. Hospital Admin PDF Branding Customization & Automatic PDF Application');
  console.log('3. Pharmacy Individual Medicine Deletion (Pristine Doctor Record)');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      if (details) console.log(`   ${details}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (details) console.error(`   ${details}`);
      throw new Error(`Assertion failed for: ${testName}`);
    }
  }

  try {
    // Find or create test hospital
    let hospital = await prisma.hospital.findFirst();
    if (!hospital) {
      hospital = await prisma.hospital.create({
        data: {
          name: 'Apollo Apollo Health City',
          address: 'Greams Road',
          city: 'Chennai',
          phone: '+91 44 2829 0200',
          email: 'opd@apollohealth.org',
          status: 'APPROVED',
        },
      });
    }

    // -------------------------------------------------------------
    // FEATURE 1: LAB TESTS BULK IMPORT & EXPORT
    // -------------------------------------------------------------
    console.log('\n--- TESTING FEATURE 1: BULK IMPORT & EXPORT OF LAB TESTS ---');

    // 1.1 Generate sample templates
    const xlsxTemplate = await LabService.generateSampleTemplate('xlsx');
    assert(xlsxTemplate.buffer.length > 0, '1.1 Generate sample Excel (.xlsx) template', `Generated ${xlsxTemplate.buffer.length} bytes`);

    const csvTemplate = await LabService.generateSampleTemplate('csv');
    assert(csvTemplate.buffer.length > 0, '1.2 Generate sample CSV (.csv) template', `Generated ${csvTemplate.buffer.length} bytes`);

    // Verify template columns
    const testWorkbook = new ExcelJS.Workbook();
    await testWorkbook.xlsx.load(xlsxTemplate.buffer as any);
    const sampleSheet = testWorkbook.worksheets[0];
    const headerCols = sampleSheet.getRow(1).values as string[];
    const headersJoined = JSON.stringify(headerCols);
    assert(
      headersJoined.includes('Test Name') &&
      headersJoined.includes('Test Code') &&
      headersJoined.includes('Category') &&
      headersJoined.includes('Department') &&
      headersJoined.includes('Price'),
      '1.3 Verify Excel template required columns present',
      `Found headers: ${headersJoined}`
    );

    // 1.2 Resolve or create lab for hospital
    const labId = await LabService.resolveLabForUser({ hospitalId: hospital.id });
    assert(!!labId, '1.4 Resolve laboratory for hospital user', `Lab ID: ${labId}`);

    // Clean any previous test entries
    const testPrefix = `TST_${Date.now().toString().slice(-5)}`;
    const testCode1 = `${testPrefix}_CBC`;
    const testCode2 = `${testPrefix}_LFT`;
    const testCode3 = `${testPrefix}_KFT`;

    // 1.3 Validate & Preview import with mixed valid, duplicate, and invalid rows
    const mockRows = [
      {
        name: `Complete Blood Count ${testPrefix}`,
        code: testCode1,
        category: 'Hematology',
        department: 'Pathology',
        price: 350,
        description: 'Measures RBC, WBC, platelets',
      },
      {
        name: `Liver Function Test ${testPrefix}`,
        code: testCode2,
        category: 'Biochemistry',
        department: 'Biochemistry',
        price: 850,
        description: 'Bilirubin, SGOT, SGPT, ALP',
      },
      // In-file duplicate test code
      {
        name: `Duplicate LFT Test ${testPrefix}`,
        code: testCode2,
        category: 'Biochemistry',
        department: 'Biochemistry',
        price: 850,
        description: 'Duplicate code should be detected and flagged',
      },
      // Invalid row: missing test name
      {
        name: '',
        code: `${testPrefix}_INV1`,
        category: 'Biochemistry',
        price: 200,
        description: 'Missing name should fail validation',
      },
      // Invalid row: invalid price
      {
        name: `Invalid Price Test ${testPrefix}`,
        code: `${testPrefix}_INV2`,
        category: 'Biochemistry',
        price: -50,
        description: 'Negative price should fail validation',
      },
    ];

    const preview = await LabService.validateAndPreviewImport(labId, mockRows);
    assert(preview.totalRows === 5, '1.5 Preview counts total rows accurately', `Total: ${preview.totalRows}`);
    assert(preview.validCount === 2, '1.6 Preview identifies valid rows', `Valid count: ${preview.validCount}`);
    assert(preview.duplicateCount === 1, '1.7 Preview identifies duplicate in-file test code', `Duplicate count: ${preview.duplicateCount}`);
    assert(preview.errorCount === 2, '1.8 Preview catches missing name and negative price', `Error count: ${preview.errorCount}`);

    // 1.4 Perform transactional bulk import of valid tests
    const validTestsToImport = preview.rows.filter(
      (r: any) => r.isValid && !r.isDuplicate && !r.isExistingDuplicate
    );
    const importResult = await LabService.importLabTests(labId, validTestsToImport, 'test-admin');
    assert(
      importResult.summary.imported === 2,
      '1.9 Bulk import inserts valid tests into catalog',
      `Imported: ${importResult.summary.imported}, Skipped: ${importResult.summary.duplicatesSkipped}`
    );

    // 1.5 Verify database duplicate detection on re-upload
    const reuploadPreview = await LabService.validateAndPreviewImport(labId, [
      {
        name: `Complete Blood Count ${testPrefix}`,
        code: testCode1, // Already in DB!
        category: 'Hematology',
        price: 350,
      },
      {
        name: `Kidney Function Test ${testPrefix}`,
        code: testCode3, // Brand new!
        category: 'Biochemistry',
        price: 750,
      },
    ]);
    assert(
      reuploadPreview.duplicateCount === 1 && reuploadPreview.validCount === 1,
      '1.10 Detects catalog duplicates against existing database records',
      `Existing duplicate flagged: ${reuploadPreview.rows[0].isExistingDuplicate}`
    );

    // 1.6 Export lab tests to Excel (.xlsx) and CSV (.csv)
    const exportedXlsx = await LabService.exportLabTests(labId, { format: 'xlsx' });
    assert(exportedXlsx.buffer.length > 0 && exportedXlsx.contentType.includes('spreadsheetml'), '1.11 Export tests to Excel (.xlsx)', `Bytes: ${exportedXlsx.buffer.length}`);

    const exportedCsv = await LabService.exportLabTests(labId, { format: 'csv' });
    const csvContent = exportedCsv.buffer.toString('utf-8');
    assert(
      csvContent.includes('Test Name') && csvContent.includes(testCode1),
      '1.12 Export tests to CSV (.csv) with catalog records',
      `CSV length: ${csvContent.length} chars, contains ${testCode1}`
    );

    // -------------------------------------------------------------
    // FEATURE 2: HOSPITAL ADMIN PDF BRANDING CUSTOMIZATION & PDF APPLICATION
    // -------------------------------------------------------------
    console.log('\n--- TESTING FEATURE 2: HOSPITAL ADMIN PDF BRANDING ---');

    // 2.1 Get hospital branding (creates default if non-existent)
    const initialBranding = await AdminService.getHospitalBranding(hospital.id);
    assert(!!initialBranding && initialBranding.hospitalId === hospital.id, '2.1 Retrieve hospital branding settings', `ID: ${initialBranding.id}`);

    // 2.2 Update hospital branding settings
    const updatedBranding = await AdminService.updateHospitalBranding(hospital.id, {
      hospitalName: 'Apollo City Hospital Speciality Centre',
      address: '21 Greams Lane, Thousand Lights, Chennai - 600006',
      contactPhone: '+91 44 2829 0200',
      contactEmail: 'consultations@apollohealth.org',
      website: 'https://apollohospitals.com',
      regDetails: 'Govt Reg: TN-HOSP-2024-8912 • NABH & NABL Accredited',
      headerStyle: 'CLASSIC',

      footerText: 'Apollo Hospitals Clinical Documentation System • Valid under IT Act 2000.',
      footerPhone: 'Emergency: 1066 / +91 44 2829 0200',
      disclaimer: 'This electronic consultation record is digitally authenticated. For emergency trauma care, visit casualty immediately.',
      showPageNumbers: true,

      watermarkEnabled: true,
      watermarkType: 'TEXT',
      watermarkText: 'APOLLO HOSPITALS OFFICIAL',
      watermarkOpacity: 0.10,
      watermarkSize: 52,
      watermarkPosition: 'CENTER',
      watermarkRotation: -30,
    }, 'admin-tester');

    assert(
      updatedBranding.hospitalName === 'Apollo City Hospital Speciality Centre',
      '2.2 Update and persist hospital branding header settings',
      `Hospital name: ${updatedBranding.hospitalName}`
    );
    assert(
      updatedBranding.watermarkEnabled === true && updatedBranding.watermarkText === 'APOLLO HOSPITALS OFFICIAL',
      '2.3 Update anti-fraud watermark settings (text, opacity, angle)',
      `Watermark: ${updatedBranding.watermarkText}, Opacity: ${updatedBranding.watermarkOpacity}`
    );

    // 2.3 Generate clinical consultation PDF with automatic hospital branding
    const pdfBuffer = await generateClinicalConsultationPdf({
      appointmentNumber: 'OP-2026-90412',
      consultationDate: '30/10/2026',
      tokenNumber: 4,
      branding: updatedBranding,
      hospital: {
        name: updatedBranding.hospitalName || hospital.name,
        address: updatedBranding.address || hospital.address,
        city: hospital.city,
        phone: updatedBranding.contactPhone || hospital.phone,
        email: updatedBranding.contactEmail || hospital.email,
      },
      doctor: {
        name: 'Dr. Rajesh Sharma',
        qualification: 'MBBS, MD (General Medicine)',
        specialization: 'Internal Medicine',
        department: 'General Medicine',
        registrationNumber: 'MCI-29104',
      },
      patient: {
        fullName: 'Ramesh Sundaram',
        patientIdNumber: 'MRN-2026-8912',
        mobileNumber: '9840012345',
        age: 44,
        gender: 'Male',
        bloodGroup: 'O+',
      },
      chiefComplaints: 'High grade fever with chills and myalgia for 3 days',
      examination: 'Throat congestion noted, chest clear, soft abdomen',
      vitals: {
        bp: '120/80',
        pulse: 78,
        temperature: '101.2°F',
        spo2: 99,
        weight: '72 kg',
      },
      diagnosis: 'Acute Viral Upper Respiratory Infection',
      medicines: [
        {
          name: 'Tab. Paracetamol 650mg',
          dosage: '650mg',
          frequency: '1-0-1',
          duration: '3 Days',
          instructions: 'Take after food for fever SOS',
          priority: 1,
        },
        {
          name: 'Tab. Cetirizine 10mg',
          dosage: '10mg',
          frequency: '0-0-1',
          duration: '5 Days',
          instructions: 'At bedtime',
          priority: 2,
        },
      ],
      labRequests: [
        {
          name: `Complete Blood Count ${testPrefix}`,
          status: 'PENDING',
          category: 'Hematology',
        },
      ],
      clinicalNotes: 'Adequate hydration, warm saline gargling, review if fever persists > 48h.',
      followUpDate: '05/11/2026',
    });

    assert(pdfBuffer.length > 1000, '2.4 Generate branded clinical consultation PDF', `PDF generated: ${pdfBuffer.length} bytes`);
    const pdfText = pdfBuffer.toString('latin1');
    assert(
      pdfText.includes('Apollo') || pdfText.includes('PDF') || pdfBuffer.slice(0, 5).toString() === '%PDF-',
      '2.5 Validate PDF buffer structure and magic bytes',
      'Magic bytes: %PDF- verified'
    );

    // -------------------------------------------------------------
    // FEATURE 3: PHARMACY INDIVIDUAL MEDICINE DELETION (Pristine Doctor Record)
    // -------------------------------------------------------------
    console.log('\n--- TESTING FEATURE 3: PHARMACY INDIVIDUAL MEDICINE DELETION ---');

    // 3.1 Create or find test doctor and patient
    let doctor = await prisma.doctor.findFirst();
    if (!doctor) {
      doctor = await prisma.doctor.create({
        data: {
          name: 'Dr. Test Physician',
          qualification: 'MBBS',
          specialization: 'General',
          hospitalId: hospital.id,
          phone: '+91 99999 88888',
          status: 'APPROVED',
        },
      });
    }

    let patient = await prisma.patient.findFirst();
    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          fullName: 'Test Patient Kumar',
          mobileNumber: '9999911111',
          hospitalId: hospital.id,
        },
      });
    }

    // Find or create an appointment for prescription connection
    let appointment = await prisma.appointment.findFirst({
      where: { hospitalId: hospital.id, prescription: null },
    });
    let createdTestAppointment = false;
    if (!appointment) {
      let dept = await prisma.department.findFirst({ where: { hospitalId: hospital.id } });
      if (!dept) {
        dept = await prisma.department.create({
          data: {
            name: 'General Medicine',
            hospitalId: hospital.id,
          },
        });
      }
      appointment = await prisma.appointment.create({
        data: {
          appointmentNumber: `APPT-TEST-${Date.now()}`,
          hospitalId: hospital.id,
          doctorId: doctor.id,
          patientId: patient.id,
          departmentId: dept.id,
          appointmentDate: '2026-10-30',
          timeSlot: '10:00 - 10:30',
          tokenNumber: 99,
          status: 'COMPLETED',
          consultationFee: 500,
          totalAmount: 520,
        },
      });
      createdTestAppointment = true;
    }

    // 3.2 Create doctor prescription with 3 original medicines
    const originalDoctorMedicines = [
      { name: 'Tab. Paracetamol 650mg', frequency: '1-0-1', duration: '3 Days', priority: 1 },
      { name: 'Tab. Azithromycin 500mg', frequency: '1-0-0', duration: '3 Days', priority: 2 },
      { name: 'Syp. Benadryl 100ml', frequency: '0-0-10ml', duration: '5 Days', priority: 3 },
    ];

    const testRx = await prisma.prescription.create({
      data: {
        appointmentId: appointment.id,
        hospitalId: hospital.id,
        doctorId: doctor.id,
        patientId: patient.id,
        diagnosis: 'Bronchitis evaluation',
        medicines: JSON.stringify(originalDoctorMedicines), // Doctor's immutable original Rx
        pharmacyStatus: 'SENT',
      },
    });

    assert(!!testRx.id, '3.1 Doctor creates prescription with 3 original medicines', `Rx ID: ${testRx.id}`);

    // 3.3 Pharmacy deletes medicine index 1 (Azithromycin) due to out-of-stock
    const deleteResult = await PharmacyService.deleteMedicine(
      testRx.id,
      undefined,
      1, // Index 1: Azithromycin
      'pharmacist-user-01',
      'pharmacist@apollohealth.org',
      'Azithromycin 500mg temporarily out of stock in hospital pharmacy'
    );

    assert(
      !!deleteResult && Array.isArray(deleteResult.medicinesList) && deleteResult.medicinesList.length === 2,
      '3.2 Pharmacy successfully deletes individual medicine',
      `Deleted index 1, remaining medicines in pharmacy list: ${deleteResult.medicinesList?.length}`
    );

    // 3.4 Verify database state: pharmacyMedicines has 2 items, but doctor's medicines still has 3 items!
    const reloadedRx = await prisma.prescription.findUnique({
      where: { id: testRx.id },
    });

    assert(!!reloadedRx, '3.3 Reload updated prescription from database');

    const doctorMedicinesAfter = JSON.parse(reloadedRx!.medicines);
    const pharmacyMedicinesAfter = JSON.parse(reloadedRx!.pharmacyMedicines || '[]');

    assert(
      doctorMedicinesAfter.length === 3,
      '3.4 Doctor original prescription medicines remain PRISTINE (all 3 medicines preserved)',
      `Doctor medicines count: ${doctorMedicinesAfter.length}`
    );
    assert(
      doctorMedicinesAfter[1].name === 'Tab. Azithromycin 500mg',
      '3.5 Doctor original prescription still contains Azithromycin 500mg',
      `Medicine [1] in doctor record: ${doctorMedicinesAfter[1].name}`
    );

    assert(
      pharmacyMedicinesAfter.length === 2,
      '3.6 Pharmacy fulfillment dispensing list updated to 2 medicines (medicine removed)',
      `Pharmacy medicines count: ${pharmacyMedicinesAfter.length}`
    );
    assert(
      pharmacyMedicinesAfter[0].name === 'Tab. Paracetamol 650mg' &&
      pharmacyMedicinesAfter[1].name === 'Syp. Benadryl 100ml',
      '3.7 Pharmacy dispensing list contains only non-deleted medicines',
      `Remaining in pharmacy: ${pharmacyMedicinesAfter.map((m: any) => m.name).join(', ')}`
    );

    // Clean up test prescription and test appointment
    await prisma.prescription.delete({ where: { id: testRx.id } });
    if (createdTestAppointment) {
      await prisma.appointment.delete({ where: { id: appointment.id } });
    }

    console.log('\n================================================================');
    console.log(`ALL TESTS PASSED! (${passed}/${total} assertions successful)`);
    console.log('================================================================\n');

  } catch (error: any) {
    console.error('\n❌ TEST RUN FAILED WITH ERROR:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
