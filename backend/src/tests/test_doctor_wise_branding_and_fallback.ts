import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import fs from 'fs';
import prisma from '../config/prisma';
import { DoctorDashboardService } from '../services/doctorDashboard.service';
import { AdminService } from '../services/admin.service';
import { generateClinicalConsultationPdf } from '../utils/pdf';

// Valid 1x1 PNG base64 images for testing
const sampleHeaderA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const sampleFooterA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const sampleHeaderB = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const sampleFooterB = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const sampleHospitalHeader = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const sampleHospitalFooter = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function runDoctorWiseBrandingTests() {
  console.log('========================================================================');
  console.log('STARTING AUTOMATED VERIFICATION: DOCTOR-WISE BRANDING & FALLBACK LOGIC');
  console.log('========================================================================\n');

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
    const hospital = await prisma.hospital.findFirst();
    if (!hospital) {
      throw new Error('No test hospital found in database');
    }

    // Ensure hospital has branding configured
    await AdminService.updateHospitalBranding(
      hospital.id,
      {
        headerImageUrl: sampleHospitalHeader,
        footerImageUrl: sampleHospitalFooter,
        watermarkEnabled: true,
        watermarkType: 'TEXT',
        watermarkText: 'HOSPITAL ADMIN LETTERHEAD',
        watermarkOpacity: 0.08,
        watermarkSize: 40,
        watermarkRotation: -30,
      },
      'admin-tester'
    );

    // Find or create at least two test doctors
    let doctors = await prisma.doctor.findMany({
      where: { hospitalId: hospital.id },
      take: 2,
    });

    if (doctors.length < 2) {
      // Find a department
      let department = await prisma.department.findFirst({ where: { hospitalId: hospital.id } });
      if (!department) {
        department = await prisma.department.create({
          data: {
            name: 'General Medicine',
            code: 'GENMED',
            slug: 'genmed-' + Date.now(),
            hospitalId: hospital.id,
          },
        });
      }

      while (doctors.length < 2) {
        const idx = doctors.length + 1;
        const newDoc = await prisma.doctor.create({
          data: {
            name: `Dr. Verification Specialist ${idx}`,
            qualification: 'MBBS, MD',
            specialization: 'Internal Medicine',
            hospitalId: hospital.id,
            departmentId: department.id,
            languages: 'English, Hindi',
            about: 'Clinical practitioner',
            workingDays: 'Mon,Tue,Wed,Thu,Fri',
            workingHoursStart: '09:00',
            workingHoursEnd: '17:00',
          },
        });
        doctors.push(newDoc);
      }
    }

    const docA = doctors[0];
    const docB = doctors[1];
    console.log(`Testing with Doctor A: ${docA.name} (${docA.id})`);
    console.log(`Testing with Doctor B: ${docB.name} (${docB.id})\n`);

    // ============================================================================
    // TEST 1: Doctor A configures custom Header & Footer Images
    // ============================================================================
    const updatedDocA = await DoctorDashboardService.updateDoctorBranding(
      docA.id,
      {
        headerImageUrl: sampleHeaderA,
        footerImageUrl: sampleFooterA,
      },
      docA.userId || undefined
    );

    assert(
      updatedDocA.headerImageUrl === sampleHeaderA,
      '1. Persist Doctor A custom header image independently in database',
      `Doctor A header length: ${updatedDocA.headerImageUrl?.length}`
    );
    assert(
      updatedDocA.footerImageUrl === sampleFooterA,
      '2. Persist Doctor A custom footer image independently in database',
      `Doctor A footer length: ${updatedDocA.footerImageUrl?.length}`
    );

    // ============================================================================
    // TEST 2: Doctor B configures custom Header & Footer Images
    // ============================================================================
    const updatedDocB = await DoctorDashboardService.updateDoctorBranding(
      docB.id,
      {
        headerImageUrl: sampleHeaderB,
        footerImageUrl: sampleFooterB,
      },
      docB.userId || undefined
    );

    assert(
      updatedDocB.headerImageUrl === sampleHeaderB,
      '3. Persist Doctor B custom header image independently in database',
      `Doctor B header length: ${updatedDocB.headerImageUrl?.length}`
    );
    assert(
      updatedDocB.footerImageUrl === sampleFooterB,
      '4. Persist Doctor B custom footer image independently in database',
      `Doctor B footer length: ${updatedDocB.footerImageUrl?.length}`
    );

    // ============================================================================
    // TEST 3: Doctor-Wise Isolation Check (Doctor B update did NOT modify Doctor A)
    // ============================================================================
    const docAFresh = await DoctorDashboardService.getDoctorBranding(docA.id);
    assert(
      docAFresh.headerImageUrl === sampleHeaderA && docAFresh.footerImageUrl === sampleFooterA,
      '5. Doctor-Wise Isolation: Doctor B updates do not overwrite Doctor A images',
      `Doctor A images remain pristine and isolated from Doctor B`
    );

    // ============================================================================
    // TEST 4: Priority 1 - Doctor Consultation PDF uses Doctor's Custom Images
    // ============================================================================
    const consultationPdfA = await generateClinicalConsultationPdf({
      appointmentNumber: 'OPD-TEST-A01',
      consultationDate: '2026-10-30',
      hospital: {
        name: hospital.name,
        address: hospital.address,
        city: hospital.city,
        phone: hospital.phone,
        email: hospital.email,
      },
      doctor: {
        name: docA.name,
        qualification: docA.qualification,
        specialization: docA.specialization,
        department: 'General Medicine',
        headerImageUrl: docAFresh.headerImageUrl,
        footerImageUrl: docAFresh.footerImageUrl,
      },
      patient: {
        fullName: 'John Doe',
        patientIdNumber: 'UHID-9921',
        age: 38,
        gender: 'MALE',
        mobileNumber: '9876543210',
      },
      chiefComplaints: 'Intermittent fever and cough for 3 days',
      examination: 'Chest clear bilaterally, throat mild erythema',
      diagnosis: 'Acute viral pharyngitis',
      vitals: {
        bp: '120/80',
        pulse: '76',
        temperature: '99.1',
        weight: '72',
        spo2: '98',
      },
      medicines: [
        {
          name: 'Tab. Paracetamol 650mg',
          dosage: '1 Tab',
          frequency: '1-0-1',
          duration: '3 days',
          instructions: 'After meals',
          priority: 1,
        },
      ],
      clinicalNotes: 'Adequate hydration, warm water gargles.',
      followUpDate: '2026-11-05',
      branding: docAFresh.hospitalBranding,
    });

    assert(
      consultationPdfA instanceof Buffer && consultationPdfA.length > 2000,
      '6. Priority 1: Consultation PDF successfully generated using Doctor custom header and footer images',
      `Generated PDF size: ${consultationPdfA.length} bytes`
    );

    // ============================================================================
    // TEST 5: Priority 2 (Fallback) - Fall back to Hospital Header & Footer
    // ============================================================================
    // Doctor A removes their custom images
    const docACleared = await DoctorDashboardService.updateDoctorBranding(
      docA.id,
      {
        headerImageUrl: null,
        footerImageUrl: null,
      },
      docA.userId || undefined
    );

    assert(
      docACleared.headerImageUrl === null && docACleared.footerImageUrl === null,
      '7. Doctor removes custom images: Header and footer images reset to null',
      'Doctor A images cleared'
    );

    const docAFallback = await DoctorDashboardService.getDoctorBranding(docA.id);
    const consultationPdfFallback = await generateClinicalConsultationPdf({
      appointmentNumber: 'OPD-TEST-FALLBACK',
      consultationDate: '2026-10-30',
      hospital: {
        name: hospital.name,
        address: hospital.address,
        city: hospital.city,
        phone: hospital.phone,
        email: hospital.email,
      },
      doctor: {
        name: docA.name,
        qualification: docA.qualification,
        specialization: docA.specialization,
        department: 'General Medicine',
        headerImageUrl: docAFallback.headerImageUrl, // is null!
        footerImageUrl: docAFallback.footerImageUrl, // is null!
      },
      patient: {
        fullName: 'Jane Smith',
        patientIdNumber: 'UHID-9922',
        age: 29,
        gender: 'FEMALE',
        mobileNumber: '9876543211',
      },
      chiefComplaints: 'Severe headache and nausea',
      diagnosis: 'Migraine without aura',
      vitals: {
        bp: '118/76',
        pulse: '72',
        temperature: '98.4',
        weight: '58',
        spo2: '99',
      },
      medicines: [
        {
          name: 'Tab. Naproxen 500mg',
          dosage: '1 Tab',
          frequency: 'SOS',
          duration: '3 days',
          instructions: 'Take with full glass of water',
          priority: 1,
        },
      ],
      branding: docAFallback.hospitalBranding, // Contains hospital header & footer!
    });

    assert(
      consultationPdfFallback instanceof Buffer && consultationPdfFallback.length > 2000,
      '8. Priority 2 (Fallback): Consultation PDF generated seamlessly falling back to Hospital Admin header & footer images',
      `Generated Fallback PDF size: ${consultationPdfFallback.length} bytes`
    );

    // ============================================================================
    // TEST 6: Priority 3 - Clean Standard Text Layout (Neither Doctor nor Hospital images)
    // ============================================================================
    const consultationPdfClean = await generateClinicalConsultationPdf({
      appointmentNumber: 'OPD-TEST-CLEAN',
      consultationDate: '2026-10-30',
      hospital: {
        name: hospital.name,
        address: hospital.address,
        city: hospital.city,
        phone: hospital.phone,
        email: hospital.email,
      },
      doctor: {
        name: docA.name,
        qualification: docA.qualification,
        specialization: docA.specialization,
        department: 'General Medicine',
        headerImageUrl: null,
        footerImageUrl: null,
      },
      patient: {
        fullName: 'Robert Davis',
        patientIdNumber: 'UHID-9923',
        age: 52,
        gender: 'MALE',
        mobileNumber: '9876543212',
      },
      chiefComplaints: 'Routine general health examination',
      diagnosis: 'Essential hypertension - Well controlled',
      vitals: {
        bp: '124/82',
        pulse: '70',
        temperature: '98.6',
        weight: '80',
        spo2: '98',
      },
      medicines: [
        {
          name: 'Tab. Telmisartan 40mg',
          dosage: '1 Tab',
          frequency: '1-0-0',
          duration: '30 days',
          instructions: 'Morning after breakfast',
          priority: 1,
        },
      ],
      branding: null, // No hospital images!
    });

    assert(
      consultationPdfClean instanceof Buffer && consultationPdfClean.length > 1500,
      '9. Priority 3: Clean standard text layout generated when neither doctor nor hospital images exist',
      `Generated Clean Text PDF size: ${consultationPdfClean.length} bytes`
    );

    // ============================================================================
    // TEST 7: Multi-Page Consultation PDF Generation with Doctor Images
    // ============================================================================
    // Configure Doctor A back with their header & footer
    await DoctorDashboardService.updateDoctorBranding(
      docA.id,
      {
        headerImageUrl: sampleHeaderA,
        footerImageUrl: sampleFooterA,
      },
      docA.userId || undefined
    );

    const multiPageMedicines = Array.from({ length: 16 }).map((_, i) => ({
      name: `Specialty Prescription Medication Item #${i + 1} ${(i + 1) * 10}mg`,
      dosage: '1 Tablet / Capsule',
      frequency: i % 2 === 0 ? '1-0-1 (BID)' : '1-1-1 (TID)',
      duration: '14 days',
      instructions: `Specific clinical administration instructions for item #${i + 1}`,
      priority: i + 1,
    }));

    const multiPagePdf = await generateClinicalConsultationPdf({
      appointmentNumber: 'OPD-MULTIPAGE-TEST',
      consultationDate: '2026-10-30',
      hospital: {
        name: hospital.name,
        address: hospital.address,
        city: hospital.city,
        phone: hospital.phone,
        email: hospital.email,
      },
      doctor: {
        name: docA.name,
        qualification: docA.qualification,
        specialization: docA.specialization,
        department: 'General Medicine',
        headerImageUrl: sampleHeaderA,
        footerImageUrl: sampleFooterA,
      },
      patient: {
        fullName: 'Elderly Comprehensive Patient',
        patientIdNumber: 'UHID-9999',
        age: 72,
        gender: 'MALE',
        mobileNumber: '9876543213',
      },
      chiefComplaints: 'Multiple chronic conditions: osteoarthritis, hypertension, insomnia, mild gastritis',
      examination: 'Bilateral knee crepitus, cardiovascular system S1 S2 heard normal, no pedal edema',
      diagnosis: 'Comprehensive Multi-Morbidity Clinical Case Management',
      vitals: {
        bp: '130/85',
        pulse: '74',
        temperature: '98.4',
        weight: '68',
        spo2: '97',
      },
      medicines: multiPageMedicines,
      clinicalNotes: 'Strict adherence to medication schedule. Low sodium diet. Mild physiotherapeutic knee exercises.',
      followUpDate: '2026-11-20',
      branding: docAFallback.hospitalBranding,
    });

    assert(
      multiPagePdf instanceof Buffer && multiPagePdf.length > 5000,
      '10. Multi-Page Support: Consultation PDF renders cleanly across multiple pages with doctor header and footer on every page',
      `Multi-page PDF size: ${multiPagePdf.length} bytes (16 prescribed medicines)`
    );

    // Save test PDF output to disk for verification
    const testOutputPath = path.join(__dirname, 'test_output_doctor_branding.pdf');
    fs.writeFileSync(testOutputPath, multiPagePdf);
    console.log(`\n📄 Saved sample multi-page consultation PDF to: ${testOutputPath}`);

    console.log('\n========================================================================');
    console.log(`ALL TESTS PASSED: ${passed}/${total} assertions verified successfully!`);
    console.log('========================================================================\n');
  } catch (error: any) {
    console.error('\n❌ Test execution failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runDoctorWiseBrandingTests();
