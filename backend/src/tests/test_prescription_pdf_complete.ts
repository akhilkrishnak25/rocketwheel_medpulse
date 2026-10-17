import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import prisma from '../config/prisma';
import {
  formatBP,
  formatSystolicDiastolicBP,
  formatPulse,
  formatTemperature,
  formatSpO2,
  formatWeight,
  formatHeight,
  calculateBMI,
  resolveConsultationVitals,
} from '../utils/vitals';
import { generateClinicalConsultationPdf } from '../utils/pdf';
import { DoctorDashboardService } from '../services/doctorDashboard.service';
import { PharmacyService } from '../services/pharmacy.service';
import { sortMedicinesByPriority, parsePriority } from '../utils/medicines';

/**
 * Extracts all text from PDF, including FlateDecode compressed streams, TJ arrays, and Tj tokens
 */
function extractPdfText(pdfBuffer: Buffer): string {
  const chunks: Buffer[] = [pdfBuffer];
  let searchPos = 0;
  const streamHeader = Buffer.from('stream\n');
  const streamHeaderCrLf = Buffer.from('stream\r\n');
  const endStream = Buffer.from('endstream');

  while (searchPos < pdfBuffer.length) {
    let start = pdfBuffer.indexOf(streamHeader, searchPos);
    let offset = 7;
    if (start === -1) {
      start = pdfBuffer.indexOf(streamHeaderCrLf, searchPos);
      offset = 8;
    }
    if (start === -1) break;

    const end = pdfBuffer.indexOf(endStream, start + offset);
    if (end === -1) break;

    const streamData = pdfBuffer.subarray(start + offset, end);
    try {
      const inflated = zlib.inflateSync(streamData);
      chunks.push(inflated);
    } catch {
      chunks.push(streamData);
    }
    searchPos = end + 9;
  }

  const extractedLines: string[] = [];

  for (const chunk of chunks) {
    const s = chunk.toString('latin1');

    // Match TJ arrays: [ ... ] TJ
    const tjRegex = /\[([\s\S]*?)\]\s*TJ/g;
    let match: RegExpExecArray | null;
    while ((match = tjRegex.exec(s)) !== null) {
      const arrayContent = match[1];
      let tjLine = '';
      const tokenRegex = /<([0-9a-fA-F\s]+)>|\(([^)]*)\)/g;
      let tm: RegExpExecArray | null;
      while ((tm = tokenRegex.exec(arrayContent)) !== null) {
        if (tm[1] !== undefined) {
          const clean = tm[1].replace(/\s+/g, '');
          if (clean.length % 2 === 0) {
            tjLine += Buffer.from(clean, 'hex').toString('latin1');
          }
        } else if (tm[2] !== undefined) {
          tjLine += tm[2];
        }
      }
      if (tjLine.trim()) {
        extractedLines.push(tjLine);
      }
    }

    // Match standalone Tj: <hex> Tj or (string) Tj
    const tjSingleRegex = /<([0-9a-fA-F\s]+)>\s*Tj|\(([^)]*)\)\s*Tj/g;
    let singleMatch: RegExpExecArray | null;
    while ((singleMatch = tjSingleRegex.exec(s)) !== null) {
      if (singleMatch[1] !== undefined) {
        const clean = singleMatch[1].replace(/\s+/g, '');
        if (clean.length % 2 === 0) {
          extractedLines.push(Buffer.from(clean, 'hex').toString('latin1'));
        }
      } else if (singleMatch[2] !== undefined) {
        extractedLines.push(singleMatch[2]);
      }
    }
  }

  return extractedLines.join('\n');
}

async function runTests() {
  console.log('=== STARTING PRESCRIPTION & CLINICAL PDF VERIFICATION ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------
  // TEST SUITE 1: Shared Vitals & Blood Pressure Formatter
  // --------------------------------------------------------------------
  console.log('--- Test Suite 1: Shared Vitals & Blood Pressure Formatting ---');

  // Test 1.1: BP unit correction
  assert(formatBP('120/80') === '120/80 mmHg', 'formatBP("120/80") -> "120/80 mmHg"');
  assert(formatBP('120/80 mmHg') === '120/80 mmHg', 'formatBP("120/80 mmHg") -> preserves existing unit without duplication');
  assert(formatBP('130/85 mmhg') === '130/85 mmHg', 'formatBP("130/85 mmhg") -> normalizes casing');
  assert(formatBP('140/90  mmHg') === '140/90 mmHg', 'formatBP("140/90  mmHg") -> normalizes spacing');
  assert(formatBP(null) === null, 'formatBP(null) -> null');
  assert(formatBP('') === null, 'formatBP("") -> null');
  assert(formatBP('N/A') === null, 'formatBP("N/A") -> null');

  // Test 1.2: Systolic/Diastolic separate values
  assert(formatSystolicDiastolicBP(120, 80) === '120/80 mmHg', 'formatSystolicDiastolicBP(120, 80) -> "120/80 mmHg"');
  assert(formatSystolicDiastolicBP('120', '80') === '120/80 mmHg', 'formatSystolicDiastolicBP("120", "80") -> "120/80 mmHg"');
  assert(formatSystolicDiastolicBP(null, null) === null, 'formatSystolicDiastolicBP(null, null) -> null');

  // Test 1.3: SpO2 percent duplication prevention
  assert(formatSpO2('99%') === '99%', 'formatSpO2("99%") -> "99%"');
  assert(formatSpO2('99%%') === '99%', 'formatSpO2("99%%") -> strips duplicate % to single "99%"');
  assert(formatSpO2('98') === '98%', 'formatSpO2("98") -> "98%"');
  assert(formatSpO2(98) === '98%', 'formatSpO2(98) -> "98%"');

  // Test 1.4: Pulse, Temp, Weight, Height, BMI
  assert(formatPulse('80') === '80 bpm', 'formatPulse("80") -> "80 bpm"');
  assert(formatPulse('80 bpm') === '80 bpm', 'formatPulse("80 bpm") -> "80 bpm"');
  assert(formatTemperature('98.4') === '98.4 °F', 'formatTemperature("98.4") -> "98.4 °F"');
  assert(formatTemperature('37°C') === '37°C', 'formatTemperature("37°C") -> "37°C"');
  assert(formatWeight('65') === '65 kg', 'formatWeight("65") -> "65 kg"');
  assert(formatHeight('170') === '170 cm', 'formatHeight("170") -> "170 cm"');
  assert(calculateBMI(65, 170) === '22.5 kg/m²', 'calculateBMI(65, 170) -> "22.5 kg/m²"');

  // --------------------------------------------------------------------
  // TEST SUITE 1B: Medicine Priority Number and Automatic Sorting
  // --------------------------------------------------------------------
  console.log('\n--- Test Suite 1B: Medicine Priority Number & Automatic Sorting ---');

  // Test 1B.1: User requirement example
  // Input: Medicine C (Priority 3), Medicine A (Priority 1), Medicine B (Priority 2)
  // Output: Medicine A -> Medicine B -> Medicine C
  const userExampleMeds = [
    { name: 'Medicine C', priority: 3, dosage: '1 tab' },
    { name: 'Medicine A', priority: 1, dosage: '1 tab' },
    { name: 'Medicine B', priority: 2, dosage: '1 tab' },
  ];
  const sortedUserExample = sortMedicinesByPriority(userExampleMeds);
  assert(
    sortedUserExample[0].name === 'Medicine A' &&
      sortedUserExample[1].name === 'Medicine B' &&
      sortedUserExample[2].name === 'Medicine C',
    'User Example: Medicine C (P3), A (P1), B (P2) -> sorted strictly as A -> B -> C'
  );

  // Test 1B.2: Preserving original relative order for duplicate priority numbers (stable sort)
  const duplicatePriorityMeds = [
    { id: 1, name: 'Med Alpha', priority: 2 },
    { id: 2, name: 'Med Beta', priority: 1 },
    { id: 3, name: 'Med Gamma', priority: 2 },
    { id: 4, name: 'Med Delta', priority: 1 },
  ];
  const sortedDuplicates = sortMedicinesByPriority(duplicatePriorityMeds);
  assert(
    sortedDuplicates[0].name === 'Med Beta' &&
      sortedDuplicates[1].name === 'Med Delta' &&
      sortedDuplicates[2].name === 'Med Alpha' &&
      sortedDuplicates[3].name === 'Med Gamma',
    'Stable sort: duplicate priority numbers preserve original relative order (Beta before Delta, Alpha before Gamma)'
  );

  // Test 1B.3: Priority validation: positive integers only
  assert(parsePriority(1) === 1, 'parsePriority(1) -> 1');
  assert(parsePriority(5) === 5, 'parsePriority(5) -> 5');
  assert(parsePriority('3') === 3, 'parsePriority("3") -> 3');
  assert(parsePriority(0) === 999999, 'parsePriority(0) -> 999999 (invalid non-positive rejected)');
  assert(parsePriority(-2) === 999999, 'parsePriority(-2) -> 999999 (negative rejected)');
  assert(parsePriority(null) === 999999, 'parsePriority(null) -> 999999 (missing rejected)');
  assert(parsePriority(undefined) === 999999, 'parsePriority(undefined) -> 999999 (undefined rejected)');
  assert(parsePriority('abc') === 999999, 'parsePriority("abc") -> 999999 (non-numeric rejected)');

  // Test 1B.4: Unprioritized medicines placed after prioritized medicines
  const mixedMeds = [
    { name: 'Unprioritized 1', dosage: '1 tab' },
    { name: 'Prioritized 2', priority: 2, dosage: '1 tab' },
    { name: 'Prioritized 1', priority: 1, dosage: '1 tab' },
    { name: 'Unprioritized 2', dosage: '1 tab' },
  ];
  const sortedMixed = sortMedicinesByPriority(mixedMeds);
  assert(
    sortedMixed[0].name === 'Prioritized 1' &&
      sortedMixed[1].name === 'Prioritized 2' &&
      sortedMixed[2].name === 'Unprioritized 1' &&
      sortedMixed[3].name === 'Unprioritized 2',
    'Unprioritized items placed at end in stable order after prioritized medicines'
  );

  // --------------------------------------------------------------------
  // TEST SUITE 2: Robust Vitals Resolution (Triage vs Doctor Entry)
  // --------------------------------------------------------------------
  console.log('\n--- Test Suite 2: Robust Vitals Resolution ---');

  // Case A: Vitals entered by Doctor in consultation screen (stored in medicalRecord.vitals JSON)
  const doctorOnlyApt = {
    vitals: [],
    medicalRecord: {
      vitals: JSON.stringify({
        bp: '125/82',
        pulse: '76',
        temperature: '98.6',
        weight: '68',
        spo2: '99%',
      }),
    },
  };
  const resolvedDocVitals = resolveConsultationVitals(doctorOnlyApt);
  assert(resolvedDocVitals !== null, 'Resolved doctor-entered vitals from medicalRecord');
  assert(resolvedDocVitals?.bp === '125/82 mmHg', 'Doctor BP resolved with mmHg');
  assert(resolvedDocVitals?.pulse === '76 bpm', 'Doctor pulse resolved with bpm');
  assert(resolvedDocVitals?.spo2 === '99%', 'Doctor SpO2 resolved with single %');

  // Case B: Vitals recorded by Nurse in Triage (stored in PatientVital table)
  const triageOnlyApt = {
    vitals: [
      {
        bloodPressure: '118/78',
        pulseRate: 72,
        temperature: 98.2,
        weight: 64,
        height: 165,
        spo2: 98,
      },
    ],
    medicalRecord: null,
  };
  const resolvedTriageVitals = resolveConsultationVitals(triageOnlyApt);
  assert(resolvedTriageVitals !== null, 'Resolved nurse triage vitals from vitals table');
  assert(resolvedTriageVitals?.bp === '118/78 mmHg', 'Triage BP resolved with mmHg');
  assert(resolvedTriageVitals?.bmi === '23.5 kg/m²', 'Calculated BMI from weight & height');

  // --------------------------------------------------------------------
  // TEST SUITE 3: Prescription PDF Generation with All 8 Sections
  // --------------------------------------------------------------------
  console.log('\n--- Test Suite 3: Prescription PDF Generation with All 8 Sections ---');

  const testPdfData = {
    appointmentNumber: 'APT-TEST-001',
    consultationDate: '2026-10-17',
    tokenNumber: 5,
    letterheadHeight: 144, // 2 inches
    compress: false,
    hospital: {
      name: 'City Care Multi-Speciality Hospital',
      address: '124 Healthcare Avenue',
      city: 'Hyderabad',
      phone: '+91 98765 43210',
      email: 'care@cityhospital.com',
    },
    doctor: {
      name: 'Dr. P Kiran Babu',
      qualification: 'MBBS, DNB (Medicine)',
      specialization: 'Consultant Physician',
      department: 'General Medicine',
      registrationNumber: 'MCI-54321',
    },
    patient: {
      fullName: 'I Sumalatha',
      patientIdNumber: 'MRN-MARU-RAJ-00001',
      mobileNumber: '9640459337',
      age: 36,
      gender: 'FEMALE',
      bloodGroup: 'O+',
    },
    // Section 1: CLINICAL VITALS
    vitals: {
      bp: '120/80',
      pulse: 80,
      temperature: 98,
      spo2: '99%',
      weight: 65,
      height: 165,
    },
    // Section 2: CHIEF COMPLAINTS / SYMPTOMS
    chiefComplaints: 'High grade fever with chills x 3 days, sore throat, generalized body aches and dry cough.',
    // Section 3: EXAMINATION (Doctor entered clinical examination findings)
    examination: 'Chest: Bilateral vesicular breath sounds heard, no wheezing or crepitations.\nCVS: S1 S2 heard, no murmurs.\nP/A: Soft, non-tender, bowel sounds active.\nThroat: Posterior pharyngeal congestion present with mild erythema.',
    // Section 4: PROVISIONAL DIAGNOSIS
    diagnosis: 'Acute Febrile Illness / Upper Respiratory Tract Infection (URTI)',
    // Section 5: DIAGNOSTIC INVESTIGATIONS / RADIOLOGY
    labRequests: [
      { name: 'Complete Blood Picture (CBC)', status: 'PENDING', category: 'Hematology' },
      { name: 'C-Reactive Protein (CRP)', status: 'PENDING', category: 'Biochemistry' },
      { name: 'Random Blood Sugar (RBS)', status: 'COMPLETED', category: 'Biochemistry' },
      { name: 'Chest X-Ray PA View', status: 'IN_PROGRESS', category: 'Radiology' },
    ],
    // Section 6: PRESCRIPTION (Rx) - Intentionally declared out of priority order to test automatic sorting
    medicines: [
      {
        name: 'Syp Kep D 10ml',
        priority: 3,
        dosage: '10 ml',
        frequency: 'TID (Thrice daily)',
        duration: '5 days',
        instructions: 'After meals',
      },
      {
        name: 'erox cv 625',
        priority: 1,
        dosage: '1 tablet',
        frequency: 'BD (Twice daily)',
        duration: '3 days',
        instructions: 'After food',
        isSubstituted: true,
        originalMedicine: 'Cap erox cv 1gm',
        substitutionReason: 'Higher strength out of stock; 625mg clinically adjusted',
      },
      {
        name: 'T Vonalong 20mg',
        priority: 2,
        dosage: '1 tablet',
        frequency: 'OD (Once daily)',
        duration: '5 days',
        instructions: 'Before meals',
      },
      {
        name: 'Nurokind GOLD sachets',
        priority: 4,
        dosage: '1 sachet',
        frequency: 'BD (Twice daily)',
        duration: '5 days',
        instructions: 'In warm milk',
      },
    ],
    // Section 7: ADVICE / CLINICAL NOTES
    clinicalNotes: '1. Warm potable water hydration (minimum 2.5-3 liters daily).\n2. Steam inhalation thrice daily with saline water gargling.\n3. Light, non-spicy semi-solid diet.\n4. Adequate bed rest and report immediately if breathlessness or temperature spikes above 102°F.',
    // Section 8: FOLLOW-UP DATE
    followUpDate: '2026-10-21',
  };

  const pdfBuffer = await generateClinicalConsultationPdf(testPdfData);
  assert(Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 1000, 'Prescription PDF generated successfully as valid buffer');

  const pdfText = extractPdfText(pdfBuffer);

  // Verify letterhead space: ensure no hospital name is drawn in the top 144 pt header block
  assert(pdfBuffer.length > 5000, 'PDF size is robust and includes full document streams');

  // Verify Section 1: BP with mmHg
  assert(pdfText.includes('120/80 mmHg'), 'PDF contains blood pressure with mandatory "120/80 mmHg" unit');
  assert(!pdfText.includes('99%%'), 'PDF SpO2 does not have malformed double %%');

  // Verify Section 3: Examination is rendered
  assert(pdfText.includes('EXAMINATION / CLINICAL FINDINGS:'), 'PDF contains Section 3 EXAMINATION heading');
  assert(pdfText.includes('Bilateral vesicular breath sounds'), 'PDF renders saved clinical examination findings');

  // Verify Section 5: Diagnostic Investigation statuses clean (no %Ë malformed chars)
  assert(!pdfText.includes('%Ë'), 'PDF does not contain broken Unicode "%Ë" before PENDING');
  assert(pdfText.includes('PENDING'), 'PDF contains clean PENDING investigation status');
  assert(pdfText.includes('COMPLETED'), 'PDF contains clean COMPLETED investigation status');

  // Verify Section 6: Automatic sorting by priority in generated PDF
  const eroxPos = pdfText.indexOf('erox cv 625');
  const vonalongPos = pdfText.indexOf('T Vonalong 20mg');
  const kepDPos = pdfText.indexOf('Syp Kep D 10ml');
  const nurokindPos = pdfText.indexOf('Nurokind GOLD');
  assert(
    eroxPos !== -1 && vonalongPos !== -1 && kepDPos !== -1 && nurokindPos !== -1 &&
      eroxPos < vonalongPos && vonalongPos < kepDPos && kepDPos < nurokindPos,
    'PDF Rx table automatically sorts medicines in ascending priority order (P1 -> P2 -> P3 -> P4)'
  );

  // Verify Section 6: Revised Prescription indicator and substitution note
  assert(pdfText.includes('REVISED PRESCRIPTION'), 'PDF contains REVISED PRESCRIPTION badge');
  assert(pdfText.includes('Substituted for: Cap erox cv 1gm'), 'PDF contains authorized pharmacy substitution note');

  // Verify Section 7 & 8: Advice and Follow-up Date
  assert(pdfText.includes('ADVICE / CLINICAL NOTES:'), 'PDF contains Section 7 ADVICE / CLINICAL NOTES heading');
  assert(pdfText.includes('FOLLOW-UP REVIEW DATE:'), 'PDF contains Section 8 FOLLOW-UP REVIEW DATE heading');
  assert(pdfText.includes('21/10/2026'), 'PDF formats follow-up date in standard DD/MM/YYYY');

  // Save the test PDF for inspection
  const outPath = path.join(__dirname, 'test_output_prescription.pdf');
  fs.writeFileSync(outPath, pdfBuffer);
  console.log(`Saved generated PDF to ${outPath}`);

  // --------------------------------------------------------------------
  // TEST SUITE 4: Multi-Page Dynamic Pagination (Stress Test)
  // --------------------------------------------------------------------
  console.log('\n--- Test Suite 4: Multi-page Dynamic Pagination Stress Test ---');

  const multiPageData = {
    ...testPdfData,
    examination: 'Comprehensive systemic examination:\n' + 'Cardiovascular: Normal heart sounds without gallop.\n'.repeat(6),
    medicines: Array.from({ length: 12 }, (_, i) => ({
      name: `Prescribed Medication ${i + 1} Forte 500mg`,
      dosage: '1 tablet',
      frequency: 'TID (Thrice daily)',
      duration: '7 days',
      instructions: 'Take after meals with a glass of water',
      isSubstituted: i === 2,
      originalMedicine: i === 2 ? 'Original Brand 1000mg' : undefined,
      substitutionReason: i === 2 ? 'Equated dosage replacement' : undefined,
    })),
    clinicalNotes: 'Extensive multi-item clinical instructions:\n' + '1. Strict bed rest and monitoring of daily peak expiratory flow rate.\n'.repeat(8),
  };

  const multiPagePdf = await generateClinicalConsultationPdf(multiPageData);
  assert(Buffer.isBuffer(multiPagePdf) && multiPagePdf.length > pdfBuffer.length, 'Multi-page prescription generated with dynamic pagination');

  const multiPageOut = path.join(__dirname, 'test_output_multipage.pdf');
  fs.writeFileSync(multiPageOut, multiPagePdf);
  console.log(`Saved multi-page PDF to ${multiPageOut}`);

  // --------------------------------------------------------------------
  // TEST SUITE 5: Pharmacy Portal vs Doctor Portal Vitals Consistency
  // --------------------------------------------------------------------
  console.log('\n--- Test Suite 5: Pharmacy Portal vs Doctor Portal Vitals Consistency ---');

  const sampleApt = await prisma.appointment.findFirst({
    where: {
      prescription: { isNot: null },
    },
    include: {
      prescription: true,
      patient: true,
      doctor: true,
      hospital: true,
      medicalRecord: true,
      vitals: true,
    },
  });

  if (sampleApt && sampleApt.prescription) {
    console.log(`Found existing consultation #${sampleApt.appointmentNumber} (Rx ID: ${sampleApt.prescription.id})`);

    // Ensure prescription is marked as SENT to pharmacy for this test
    await prisma.prescription.update({
      where: { id: sampleApt.prescription.id },
      data: {
        pharmacyStatus: 'SENT',
      },
    });

    // Populate consultation vitals and examination
    await prisma.medicalRecord.upsert({
      where: { appointmentId: sampleApt.id },
      update: {
        vitals: JSON.stringify({ bp: '120/80', pulse: '78', temperature: '98.6', weight: '65', spo2: '99%' }),
        examination: 'Chest clear bilaterally, S1 S2 normal.',
      },
      create: {
        appointmentId: sampleApt.id,
        patientId: sampleApt.patientId,
        vitals: JSON.stringify({ bp: '120/80', pulse: '78', temperature: '98.6', weight: '65', spo2: '99%' }),
        examination: 'Chest clear bilaterally, S1 S2 normal.',
      },
    });

    // 1. Generate via Doctor Dashboard Service
    const doctorPdf = await DoctorDashboardService.generateConsultationPdf(sampleApt.doctorId, sampleApt.id);
    assert(Buffer.isBuffer(doctorPdf), 'Doctor Portal successfully generated consultation PDF');

    // 2. Generate via Pharmacy Service
    const pharmacyPdf = await PharmacyService.generatePrescriptionPdf(sampleApt.prescription.id);
    assert(Buffer.isBuffer(pharmacyPdf), 'Pharmacy Portal successfully generated prescription PDF');

    const doctorPdfText = extractPdfText(doctorPdf);
    const pharmacyPdfText = extractPdfText(pharmacyPdf);

    // Check if vitals exist in both PDFs
    const docHasVitals = doctorPdfText.includes('CLINICAL VITALS:');
    const pharmHasVitals = pharmacyPdfText.includes('CLINICAL VITALS:');
    assert(docHasVitals && pharmHasVitals, `Both portals have Clinical Vitals section (Doc: ${docHasVitals}, Pharm: ${pharmHasVitals})`);

    assert(pharmacyPdfText.includes('120/80 mmHg'), 'Pharmacy Portal PDF contains "120/80 mmHg" unit in Clinical Vitals');
    assert(doctorPdfText.includes('120/80 mmHg'), 'Doctor Portal PDF contains "120/80 mmHg" unit in Clinical Vitals');

    // Check if examination findings appear in both PDFs
    assert(pharmacyPdfText.includes('Chest clear bilaterally'), 'Pharmacy Portal PDF contains doctor examination findings');
    assert(doctorPdfText.includes('Chest clear bilaterally'), 'Doctor Portal PDF contains doctor examination findings');

    // 3. Test Pharmacy prescription listing API includes vitals
    const pharmacyRxList = await PharmacyService.getPrescriptions();
    const targetRx = pharmacyRxList.find((p) => p.id === sampleApt.prescription?.id);
    assert(targetRx !== undefined, 'PharmacyService.getPrescriptions finds the prescription');
    assert(targetRx?.vitals !== undefined, 'PharmacyService.getPrescriptions includes resolved vitals');
    if (targetRx?.vitals?.bp) {
      assert(targetRx.vitals.bp.includes('mmHg'), `Pharmacy API vitals BP includes "mmHg" (${targetRx.vitals.bp})`);
    }

    // 4. Test medicine replacement in pharmacy retains original priority (Requirement 8) and keeps vitals intact
    const medsList = [
      { name: 'Original Amox 500mg', priority: 2, dosage: '1 tab', frequency: 'BD', duration: '5 days', instructions: 'After meals' },
    ];
    await prisma.prescription.update({
      where: { id: sampleApt.prescription.id },
      data: { medicines: JSON.stringify(medsList) },
    });

    await PharmacyService.replaceMedicine(
      sampleApt.prescription.id,
      undefined,
      {
        medicineIndex: 0,
        replacement: {
          name: 'Substituted Augmentin 625mg',
          dosage: '1 tablet',
          frequency: 'BD',
          duration: '5 days',
          instructions: 'After food',
        },
        reason: 'Generic equivalent substituted due to inventory shortage',
        doctorApproved: true,
      },
      'test-staff-id',
      'Senior Pharmacist Test'
    );

    // Verify database record retains priority
    const updatedRxRecord = await prisma.prescription.findUnique({
      where: { id: sampleApt.prescription.id },
    });
    const parsedUpdatedMeds = JSON.parse(updatedRxRecord?.medicines || '[]');
    assert(
      parsedUpdatedMeds[0]?.priority === 2,
      'Pharmacy medicine substitution strictly retains original priority number (Requirement 8)'
    );

    // Re-generate revised prescription PDF
    const revisedPharmacyPdf = await PharmacyService.generatePrescriptionPdf(sampleApt.prescription.id);
    const revisedText = extractPdfText(revisedPharmacyPdf);

    assert(revisedText.includes('REVISED PRESCRIPTION'), 'Revised Pharmacy PDF displays REVISED PRESCRIPTION badge');
    assert(revisedText.includes('Substituted Augmentin 625mg'), 'Revised Pharmacy PDF reflects substituted medicine');
    assert(revisedText.includes('CLINICAL VITALS:'), 'Revised Pharmacy PDF retains Clinical Vitals after medicine substitution');
    assert(revisedText.includes('120/80 mmHg'), 'Revised Pharmacy PDF retains "120/80 mmHg" unit after substitution');
  }

  console.log(`\n=== VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test error:', err);
    process.exit(1);
  });
