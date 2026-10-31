import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import fs from 'fs';
import { generateClinicalConsultationPdf } from '../utils/pdf';

async function verifyUserPrescription() {
  const sampleHeader = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const pdfData = {
    appointmentNumber: 'MRN-TEST-SRI-00004',
    consultationDate: '31/10/2026',
    hospital: {
      name: 'Maruthi Health Care',
      address: 'Near Clock Tower',
      city: 'Hyderabad',
      phone: '9182238568',
      email: 'contact@maruthihealthcare.com',
    },
    doctor: {
      name: 'Dr Pradeep', // Notice starts with Dr without dot
      qualification: 'MBBS, MD',
      specialization: 'GENERAL MEDICINE',
      department: 'General Medicine',
      registrationNumber: '109799',
      headerImageUrl: sampleHeader,
      footerImageUrl: null,
    },
    patient: {
      fullName: 'laxmi',
      patientIdNumber: 'MRN-TEST-SRI-00004',
      age: 45,
      gender: 'Female',
      bloodGroup: 'B+',
      mobileNumber: '9182238568',
    },
    chiefComplaints: 'high fever/ cold/ pains',
    examination: 'fsdf eregergj ergejhn egjedrjhetdkth',
    vitals: {
      bp: '120/80',
      pulse: '77',
      temperature: '99',
      spo2: '95',
      weight: '65',
    },
    diagnosis: 'Acute Diarrhea',
    labRequests: [
      { name: 'cbc', category: 'test lab2', status: 'ORDERED' },
      { name: 'rkt', category: 'test lab2', status: 'ORDERED' },
      { name: 'rfkt', category: 'test lab2', status: 'ORDERED' },
    ],
    medicines: [
      {
        name: 'Ofloxacin-Ornidazole',
        dosage: '1 Tab',
        frequency: '1-0-1',
        duration: '5 days',
        instructions: 'After food',
        priority: 1,
      },
      {
        name: 'ORS Sachet',
        dosage: '1 Sachet',
        frequency: 'As needed',
        duration: '3 days',
        instructions: 'After food',
        priority: 2,
      },
    ],
    clinicalNotes: 'Hydration with ORS',
    followUpDate: '02/11/2026',
    branding: null,
  };

  const pdfBuffer = await generateClinicalConsultationPdf(pdfData);

  // Parse page count using regex on PDF buffer
  const pdfString = pdfBuffer.toString('binary');
  const pageMatches = pdfString.match(/\/Type\s*\/Page\b/g);
  const pageCount = pageMatches ? pageMatches.length : 1;

  console.log(`Generated PDF byte size: ${pdfBuffer.length}`);
  console.log(`Total Pages: ${pageCount}`);

  const outputPath = path.join(__dirname, 'test_user_exact_rx.pdf');
  fs.writeFileSync(outputPath, pdfBuffer);
  console.log(`Saved exact PDF to: ${outputPath}`);

  if (pageCount === 1) {
    console.log('SUCCESS: Generated exactly 1 clean page with doctor sign above footer!');
  } else {
    console.error(`WARNING: Generated ${pageCount} pages instead of 1 page.`);
  }
}

verifyUserPrescription();
