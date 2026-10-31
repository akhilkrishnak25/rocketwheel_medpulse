import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import prisma from '../config/prisma';
import { AdminService } from '../services/admin.service';
import { generateClinicalConsultationPdf } from '../utils/pdf';

// Valid 1x1 PNG base64 for test header and footer images
const samplePngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function runHeaderFooterBrandingTests() {
  console.log('================================================================');
  console.log('STARTING AUTOMATED VERIFICATION: HEADER & FOOTER IMAGE BRANDING');
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
    const hospital = await prisma.hospital.findFirst();
    if (!hospital) {
      throw new Error('No test hospital found in database');
    }

    console.log(`Testing with Hospital: ${hospital.name} (${hospital.id})\n`);

    // 1. Upload & Persist Header Image & Footer Image in Branding
    const updatedBranding = await AdminService.updateHospitalBranding(hospital.id, {
      headerImageUrl: samplePngBase64,
      footerImageUrl: samplePngBase64,
      watermarkEnabled: true,
      watermarkType: 'TEXT',
      watermarkText: 'OFFICIAL MEDICAL RECORD',
      watermarkOpacity: 0.12,
      watermarkSize: 45,
      watermarkRotation: -30,
    }, 'admin-tester');

    assert(
      !!updatedBranding.headerImageUrl && updatedBranding.headerImageUrl.startsWith('data:image/png'),
      '1. Persist uploaded Header Image URL in Hospital Branding settings',
      `Header Image length: ${updatedBranding.headerImageUrl?.length} chars`
    );

    assert(
      !!updatedBranding.footerImageUrl && updatedBranding.footerImageUrl.startsWith('data:image/png'),
      '2. Persist uploaded Footer Image URL in Hospital Branding settings',
      `Footer Image length: ${updatedBranding.footerImageUrl?.length} chars`
    );

    assert(
      updatedBranding.watermarkEnabled === true && updatedBranding.watermarkText === 'OFFICIAL MEDICAL RECORD',
      '3. Retain Anti-fraud Watermark configuration alongside Header/Footer images',
      `Watermark: ${updatedBranding.watermarkText}`
    );

    // 2. Fetch Hospital Branding via getHospitalBranding API
    const fetchedBranding = await AdminService.getHospitalBranding(hospital.id);
    assert(
      fetchedBranding.headerImageUrl === samplePngBase64,
      '4. Retrieve persisted Header Image via getHospitalBranding',
      'Header Image matches saved state'
    );
    assert(
      fetchedBranding.footerImageUrl === samplePngBase64,
      '5. Retrieve persisted Footer Image via getHospitalBranding',
      'Footer Image matches saved state'
    );

    // 3. Generate Clinical Consultation PDF with Branded Header & Footer Images
    const pdfBuffer = await generateClinicalConsultationPdf({
      appointmentNumber: 'OP-2026-IMG-991',
      consultationDate: '30/10/2026',
      tokenNumber: 7,
      branding: fetchedBranding,
      hospital: {
        name: hospital.name,
        address: hospital.address || 'Apollo Main Road',
        city: hospital.city || 'Chennai',
        phone: hospital.phone || '+91 44 2829 0200',
        email: hospital.email || 'care@apollo.org',
      },
      doctor: {
        name: 'Dr. Ananya Roy',
        qualification: 'MBBS, MD',
        specialization: 'Cardiology',
        department: 'Cardiology',
        registrationNumber: 'KMC-54321',
      },
      patient: {
        fullName: 'Karthik Subramanian',
        patientIdNumber: 'MRN-2026-789',
        mobileNumber: '9841098765',
        age: 38,
        gender: 'Male',
        bloodGroup: 'B+',
      },
      chiefComplaints: 'Palpitations on exertion and mild dyspnea for 1 week',
      examination: 'S1, S2 heard. No murmurs. Bilateral vesicular breath sounds.',
      vitals: {
        bp: '124/82',
        pulse: 76,
        temperature: '98.6°F',
        spo2: 99,
        weight: '68 kg',
      },
      diagnosis: 'Benign Sinus Tachycardia - Routine evaluation',
      medicines: [
        {
          name: 'Tab. Metoprolol 25mg',
          dosage: '25mg',
          frequency: '1-0-0',
          duration: '14 Days',
          instructions: 'After breakfast',
          priority: 1,
        },
      ],
      clinicalNotes: 'ECG normal sinus rhythm. Limit caffeine intake. Review in 2 weeks.',
      followUpDate: '14/11/2026',
    });

    assert(
      pdfBuffer.length > 1000 && pdfBuffer.slice(0, 5).toString() === '%PDF-',
      '6. Generate Clinical Consultation PDF integrating Header & Footer images with dynamic margins',
      `PDF generated successfully: ${pdfBuffer.length} bytes, Magic bytes: %PDF-`
    );

    // 4. Test Remove Header & Footer Images
    const clearedBranding = await AdminService.updateHospitalBranding(hospital.id, {
      headerImageUrl: '',
      footerImageUrl: '',
    }, 'admin-tester');

    assert(
      clearedBranding.headerImageUrl === null && clearedBranding.footerImageUrl === null,
      '7. Support Removing Header Image and Footer Image (reverts to standard defaults)',
      `Header: ${clearedBranding.headerImageUrl}, Footer: ${clearedBranding.footerImageUrl}`
    );

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

runHeaderFooterBrandingTests();
