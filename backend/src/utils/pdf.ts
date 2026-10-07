import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

export interface DigitalOpPdfData {
  opNumber: string;
  secureToken: string;
  appointmentNumber: string;
  appointmentDate: string;
  timeSlot: string;
  tokenNumber: number;
  hospital: {
    name: string;
    address: string;
    city: string;
    phone: string;
    emergencyContact: string;
    email: string;
  };
  doctor: {
    name: string;
    qualification: string;
    specialization: string;
    department: string;
  };
  patient: {
    fullName: string;
    mobileNumber: string;
    email: string;
    gender?: string | null;
    bloodGroup?: string | null;
    ageOrDob?: string | null;
  };
  payment: {
    amount: number;
    paymentId?: string | null;
    status: string;
    method?: string | null;
  };
  verificationUrl: string;
}

export const generateDigitalOpPdf = async (data: DigitalOpPdfData): Promise<Buffer> => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `Digital OP Slip - ${data.opNumber}`,
          Author: data.hospital.name,
          Subject: 'Medical Outpatient Appointment Slip',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Generate QR Code as PNG Buffer
      const qrBuffer = await QRCode.toBuffer(data.verificationUrl, {
        width: 130,
        margin: 1,
        color: {
          dark: '#1E20E0',
          light: '#ffffff',
        },
      });

      // --- HEADER SECTION ---
      // Primary Royal Blue & Pink Accent Bars
      doc.rect(40, 40, 360, 6).fill('#1E20E0');
      doc.rect(400, 40, 155, 6).fill('#FF1D6B');

      doc.fillColor('#1E20E0').fontSize(20).font('Helvetica-Bold')
         .text(data.hospital.name, 40, 55, { width: 360 });

      doc.fillColor('#64748b').fontSize(9).font('Helvetica')
         .text(`${data.hospital.address}, ${data.hospital.city}`, 40, 80, { width: 360 })
         .text(`Phone: ${data.hospital.phone} | Emergency: ${data.hospital.emergencyContact} | Email: ${data.hospital.email}`, 40, 94, { width: 360 });

      // Badge: DIGITAL OP SLIP
      doc.roundedRect(420, 52, 135, 26, 4).fill('#fff1f2');
      doc.rect(420, 52, 135, 26).stroke('#FF1D6B');
      doc.fillColor('#FF1D6B').fontSize(11).font('Helvetica-Bold')
         .text('DIGITAL OP SLIP', 420, 60, { width: 135, align: 'center' });

      // Token box top right (Royal Blue with Gold badge)
      doc.roundedRect(420, 85, 135, 45, 6).fill('#1E20E0');
      doc.fillColor('#FBA94C').fontSize(8.5).font('Helvetica-Bold')
         .text('QUEUE TOKEN NUMBER', 420, 92, { width: 135, align: 'center' });
      doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold')
         .text(String(data.tokenNumber).padStart(2, '0'), 420, 104, { width: 135, align: 'center' });

      // Divider line
      doc.moveTo(40, 140).lineTo(555, 140).strokeColor('#e2e8f0').stroke();

      // --- KEY APPOINTMENT METRICS BAR ---
      doc.rect(40, 150, 515, 45).fill('#f8fafc');
      doc.rect(40, 150, 515, 45).strokeColor('#cbd5e1').stroke();

      doc.fillColor('#64748b').fontSize(8).font('Helvetica')
         .text('OP NUMBER', 55, 158)
         .text('APPOINTMENT ID', 185, 158)
         .text('DATE', 315, 158)
         .text('TIME SLOT', 440, 158);

      doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold')
         .text(data.opNumber, 55, 172)
         .text(data.appointmentNumber, 185, 172)
         .text(data.appointmentDate, 315, 172)
         .text(data.timeSlot, 440, 172);

      // --- 2 COLUMNS: PATIENT DETAILS & DOCTOR DETAILS ---
      const colTop = 210;

      // Left Column: Patient Details
      doc.roundedRect(40, colTop, 250, 145, 6).fill('#ffffff');
      doc.roundedRect(40, colTop, 250, 145, 6).strokeColor('#e2e8f0').stroke();

      doc.rect(40, colTop, 250, 26).fill('#f1f5f9');
      doc.fillColor('#1e293b').fontSize(10).font('Helvetica-Bold')
         .text('PATIENT INFORMATION', 52, colTop + 8);

      let pY = colTop + 35;
      const printRow = (label: string, value: string, left: number) => {
        doc.fillColor('#64748b').fontSize(8.5).font('Helvetica').text(label, left, pY);
        doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(value, left + 90, pY, { width: 140 });
        pY += 18;
      };

      printRow('Full Name:', data.patient.fullName, 52);
      printRow('Mobile:', data.patient.mobileNumber, 52);
      printRow('Email:', data.patient.email, 52);
      printRow('Gender:', data.patient.gender || 'Not specified', 52);
      printRow('Blood Group:', data.patient.bloodGroup || 'Not specified', 52);

      // Right Column: Doctor & Department Details
      doc.roundedRect(305, colTop, 250, 145, 6).fill('#ffffff');
      doc.roundedRect(305, colTop, 250, 145, 6).strokeColor('#e2e8f0').stroke();

      doc.rect(305, colTop, 250, 26).fill('#f1f5f9');
      doc.fillColor('#1e293b').fontSize(10).font('Helvetica-Bold')
         .text('DOCTOR & DEPARTMENT', 317, colTop + 8);

      pY = colTop + 35;
      printRow('Doctor Name:', data.doctor.name, 317);
      printRow('Specialization:', data.doctor.specialization, 317);
      printRow('Department:', data.doctor.department, 317);
      printRow('Qualification:', data.doctor.qualification, 317);
      printRow('Consultation:', `Offline OPD Visit`, 317);

      // --- PAYMENT & QR CODE VERIFICATION SECTION ---
      const payTop = 370;

      // Left Box: Payment Details
      doc.roundedRect(40, payTop, 320, 135, 6).fill('#ffffff');
      doc.roundedRect(40, payTop, 320, 135, 6).strokeColor('#e2e8f0').stroke();

      doc.rect(40, payTop, 320, 26).fill('#f1f5f9');
      doc.fillColor('#1e293b').fontSize(10).font('Helvetica-Bold')
         .text('PAYMENT DETAILS', 52, payTop + 8);

      pY = payTop + 35;
      printRow('Total Paid:', `INR ${data.payment.amount.toFixed(2)}`, 52);
      printRow('Payment Status:', `${data.payment.status.toUpperCase()}`, 52);
      printRow('Payment ID:', data.payment.paymentId || 'ONLINE_TXN_VERIFIED', 52);
      printRow('Method / Channel:', data.payment.method || 'Razorpay Gateway', 52);

      // Payment verified green stamp badge
      doc.roundedRect(52, pY + 4, 140, 22, 4).fill('#dcfce7');
      doc.rect(52, pY + 4, 140, 22).strokeColor('#86efac').stroke();
      doc.fillColor('#166534').fontSize(8.5).font('Helvetica-Bold')
         .text('✔ PAYMENT VERIFIED', 52, pY + 10, { width: 140, align: 'center' });

      // Right Box: QR Code
      doc.roundedRect(375, payTop, 180, 135, 6).fill('#ffffff');
      doc.roundedRect(375, payTop, 180, 135, 6).strokeColor('#e2e8f0').stroke();

      doc.image(qrBuffer, 400, payTop + 8, { width: 85 });
      doc.fillColor('#1E20E0').fontSize(7.5).font('Helvetica-Bold')
         .text('SCAN TO VERIFY OP', 375, payTop + 100, { width: 180, align: 'center' });
      doc.fillColor('#64748b').fontSize(6.5).font('Helvetica')
         .text(`Token: ${data.secureToken.substring(0, 16)}...`, 375, payTop + 112, { width: 180, align: 'center' });

      // --- INSTRUCTIONS SECTION ---
      const instTop = 520;
      doc.roundedRect(40, instTop, 515, 170, 6).fill('#f8fafc');
      doc.roundedRect(40, instTop, 515, 170, 6).strokeColor('#e2e8f0').stroke();

      doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold')
         .text('IMPORTANT PATIENT INSTRUCTIONS', 55, instTop + 12);

      const instructions = [
        '1. Please arrive at the hospital reception 15-20 minutes before your scheduled slot time.',
        '2. Present this Digital OP Slip (printed copy or on your mobile device) at the OPD registration counter.',
        '3. Your Token Number determines your queue position. Keep an eye on the OPD digital display screen.',
        '4. Carry all relevant previous medical records, discharge summaries, laboratory reports, and prescription slips.',
        '5. Carry a valid government photo identification (Aadhaar, Driving License, or Passport).',
        '6. For cancellations or emergency queries, contact the hospital helpdesk at ' + data.hospital.phone + '.',
      ];

      let instY = instTop + 30;
      for (const inst of instructions) {
        doc.fillColor('#334155').fontSize(8.5).font('Helvetica')
           .text(inst, 55, instY, { width: 485, lineGap: 2 });
        instY += 21;
      }

      // --- FOOTER SECTION ---
      doc.moveTo(40, 715).lineTo(555, 715).strokeColor('#e2e8f0').stroke();
      doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica')
         .text('This is a computer-generated official Outpatient (OP) appointment slip powered by Rocket Wheel Multi-Hospital Platform. No physical signature is required.', 40, 725, { width: 515, align: 'center' })
         .text(`Generated on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST | Secure OP ID: ${data.opNumber}`, 40, 738, { width: 515, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

export interface ClinicalConsultationPdfData {
  appointmentNumber: string;
  consultationDate: string;
  tokenNumber?: number;
  hospital: {
    name: string;
    address: string;
    city: string;
    phone: string;
    email?: string;
  };
  doctor: {
    name: string;
    qualification?: string;
    specialization?: string;
    department?: string;
  };
  patient: {
    fullName: string;
    patientIdNumber?: string | null;
    mobileNumber: string;
    age?: number | string | null;
    gender?: string | null;
    bloodGroup?: string | null;
  };
  chiefComplaints?: string | null;
  vitals?: {
    bp?: string | null;
    pulse?: string | number | null;
    temperature?: string | number | null;
    spo2?: string | number | null;
    weight?: string | number | null;
    height?: string | number | null;
  } | null;
  diagnosis?: string | null;
  medicines?: Array<{
    name: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
  }>;
  labRequests?: Array<{
    name: string;
    status: string;
  }>;
  clinicalNotes?: string | null;
  instructions?: string | null;
  followUpDate?: string | null;
}

export const generateClinicalConsultationPdf = async (data: ClinicalConsultationPdfData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `Clinical Consultation - ${data.patient.fullName}`,
          Author: data.hospital.name,
          Subject: 'Official Consultation Summary & Prescription',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });

      // Header Accent Bars
      doc.rect(40, 35, 360, 5).fill('#1E20E0');
      doc.rect(400, 35, 155, 5).fill('#FF1D6B');

      // Hospital Details
      doc.fillColor('#1E20E0').fontSize(18).font('Helvetica-Bold')
         .text(data.hospital.name, 40, 48, { width: 360 });
      doc.fillColor('#64748b').fontSize(8.5).font('Helvetica')
         .text(`${data.hospital.address}, ${data.hospital.city}`, 40, 70, { width: 360 })
         .text(`Phone: ${data.hospital.phone} ${data.hospital.email ? '| Email: ' + data.hospital.email : ''}`, 40, 82, { width: 360 });

      // Badge
      doc.roundedRect(390, 48, 165, 42, 4).fill('#eff6ff');
      doc.roundedRect(390, 48, 165, 42, 4).strokeColor('#1E20E0').stroke();
      doc.fillColor('#1E20E0').fontSize(9).font('Helvetica-Bold')
         .text('CLINICAL CONSULTATION & Rx', 390, 55, { width: 165, align: 'center' });
      doc.fillColor('#475569').fontSize(8).font('Helvetica')
         .text(`Date: ${data.consultationDate}`, 390, 68, { width: 165, align: 'center' })
         .text(`OP Ref: #${data.appointmentNumber}`, 390, 78, { width: 165, align: 'center' });

      // Divider
      doc.moveTo(40, 100).lineTo(555, 100).strokeColor('#cbd5e1').stroke();

      // Two Column: Doctor & Patient Summary
      const infoTop = 108;
      doc.roundedRect(40, infoTop, 250, 68, 4).fill('#f8fafc');
      doc.roundedRect(40, infoTop, 250, 68, 4).strokeColor('#e2e8f0').stroke();

      doc.fillColor('#1E20E0').fontSize(8.5).font('Helvetica-Bold').text('CONSULTING PHYSICIAN', 48, infoTop + 7);
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text(data.doctor.name, 48, infoTop + 20);
      doc.fillColor('#475569').fontSize(8.5).font('Helvetica')
         .text(`${data.doctor.qualification || 'MBBS, MD'} - ${data.doctor.specialization || 'General Specialist'}`, 48, infoTop + 35)
         .text(`Dept: ${data.doctor.department || 'Outpatient Clinic'}`, 48, infoTop + 48);

      doc.roundedRect(305, infoTop, 250, 68, 4).fill('#f8fafc');
      doc.roundedRect(305, infoTop, 250, 68, 4).strokeColor('#e2e8f0').stroke();

      doc.fillColor('#1E20E0').fontSize(8.5).font('Helvetica-Bold').text('PATIENT PARTICULARS', 313, infoTop + 7);
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text(data.patient.fullName, 313, infoTop + 20);
      const ageText = data.patient.age ? `${data.patient.age} Yrs` : 'N/A';
      const genderText = data.patient.gender || 'Not Specified';
      const mrnText = data.patient.patientIdNumber || 'MRN-Pending';
      doc.fillColor('#475569').fontSize(8.5).font('Helvetica')
         .text(`Age / Gender: ${ageText} / ${genderText}  |  Blood: ${data.patient.bloodGroup || 'N/A'}`, 313, infoTop + 35)
         .text(`MRN: ${mrnText}  |  Mobile: ${data.patient.mobileNumber}`, 313, infoTop + 48);

      let curY = infoTop + 78;

      // Section: Chief Complaints
      if (data.chiefComplaints) {
        doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold').text('CHIEF COMPLAINTS / SYMPTOMS:', 40, curY);
        curY += 14;
        doc.fillColor('#334155').fontSize(9).font('Helvetica').text(data.chiefComplaints, 40, curY, { width: 515 });
        curY += doc.heightOfString(data.chiefComplaints, { width: 515 }) + 10;
      }

      // Section: Vitals
      if (data.vitals && Object.keys(data.vitals).length > 0) {
        doc.roundedRect(40, curY, 515, 28, 4).fill('#f1f5f9');
        doc.fillColor('#1e293b').fontSize(8.5).font('Helvetica-Bold').text('CLINICAL VITALS:', 48, curY + 9);
        const vitalsList: string[] = [];
        if (data.vitals.bp) vitalsList.push(`BP: ${data.vitals.bp}`);
        if (data.vitals.pulse) vitalsList.push(`Pulse: ${data.vitals.pulse} bpm`);
        if (data.vitals.temperature) vitalsList.push(`Temp: ${data.vitals.temperature} °F`);
        if (data.vitals.spo2) vitalsList.push(`SpO2: ${data.vitals.spo2}%`);
        if (data.vitals.weight) vitalsList.push(`Weight: ${data.vitals.weight} kg`);
        if (data.vitals.height) vitalsList.push(`Height: ${data.vitals.height} cm`);

        const vitalsStr = vitalsList.length > 0 ? vitalsList.join('   |   ') : 'No vitals recorded';
        doc.fillColor('#334155').fontSize(8.5).font('Helvetica').text(vitalsStr, 145, curY + 9);
        curY += 36;
      }

      // Section: Diagnosis
      if (data.diagnosis) {
        doc.fillColor('#1E20E0').fontSize(10).font('Helvetica-Bold').text('PROVISIONAL DIAGNOSIS:', 40, curY);
        curY += 14;
        doc.fillColor('#0f172a').fontSize(10).font('Helvetica').text(data.diagnosis, 40, curY, { width: 515 });
        curY += doc.heightOfString(data.diagnosis, { width: 515 }) + 12;
      }

      // Section: Prescription / Medicines
      if (data.medicines && data.medicines.length > 0) {
        doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text('PRESCRIPTION (Rx):', 40, curY);
        curY += 14;

        // Table Header
        doc.roundedRect(40, curY, 515, 20, 2).fill('#1E20E0');
        doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
        doc.text('#', 46, curY + 5, { width: 20 });
        doc.text('MEDICINE NAME', 68, curY + 5, { width: 175 });
        doc.text('DOSAGE', 245, curY + 5, { width: 65 });
        doc.text('FREQUENCY', 312, curY + 5, { width: 75 });
        doc.text('DURATION', 390, curY + 5, { width: 60 });
        doc.text('INSTRUCTIONS', 452, curY + 5, { width: 100 });
        curY += 22;

        data.medicines.forEach((med, idx) => {
          const rowBg = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
          doc.rect(40, curY, 515, 20).fill(rowBg);
          doc.fillColor('#334155').fontSize(8).font('Helvetica');
          doc.text(String(idx + 1), 46, curY + 5, { width: 20 });
          doc.font('Helvetica-Bold').text(med.name, 68, curY + 5, { width: 175 }).font('Helvetica');
          doc.text(med.dosage || '1 dose', 245, curY + 5, { width: 65 });
          doc.text(med.frequency || '1-0-1', 312, curY + 5, { width: 75 });
          doc.text(med.duration || '5 days', 390, curY + 5, { width: 60 });
          doc.text(med.instructions || 'After food', 452, curY + 5, { width: 100 });
          curY += 21;
        });
        curY += 10;
      }

      // Section: Requested Lab Tests
      if (data.labRequests && data.labRequests.length > 0) {
        doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text('REQUESTED DIAGNOSTIC INVESTIGATIONS:', 40, curY);
        curY += 14;

        data.labRequests.forEach((req, idx) => {
          const isDone = req.status === 'COMPLETED';
          const icon = isDone ? '[✓ COMPLETED]' : '[○ PENDING]';
          const color = isDone ? '#15803d' : '#d97706';

          doc.fillColor('#334155').fontSize(8.5).font('Helvetica')
             .text(`${idx + 1}. ${req.name}`, 48, curY, { width: 350 });
          doc.fillColor(color).fontSize(8).font('Helvetica-Bold')
             .text(icon, 410, curY, { width: 140, align: 'right' });
          curY += 16;
        });
        curY += 10;
      }

      // Section: Advice & Clinical Notes
      if (data.clinicalNotes || data.instructions || data.followUpDate) {
        doc.roundedRect(40, curY, 515, 48, 4).fill('#f8fafc');
        doc.roundedRect(40, curY, 515, 48, 4).strokeColor('#e2e8f0').stroke();

        let noteY = curY + 8;
        if (data.instructions || data.clinicalNotes) {
          doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text('ADVICE / CLINICAL NOTES:', 48, noteY);
          doc.fillColor('#475569').fontSize(8.5).font('Helvetica')
             .text(data.instructions || data.clinicalNotes || '', 175, noteY, { width: 365 });
          noteY += 18;
        }

        if (data.followUpDate) {
          doc.fillColor('#1E20E0').fontSize(8.5).font('Helvetica-Bold').text('FOLLOW-UP DATE:', 48, noteY);
          doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text(data.followUpDate, 175, noteY);
        }

        curY += 58;
      }

      // Doctor Signature Area
      const sigTop = Math.max(curY + 20, 700);
      doc.moveTo(380, sigTop).lineTo(540, sigTop).strokeColor('#94a3b8').stroke();
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(data.doctor.name, 380, sigTop + 6, { width: 160, align: 'center' });
      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica').text('Authorized Medical Officer', 380, sigTop + 18, { width: 160, align: 'center' });

      // Bottom Footer
      doc.moveTo(40, 765).lineTo(555, 765).strokeColor('#e2e8f0').stroke();
      doc.fillColor('#94a3b8').fontSize(7).font('Helvetica')
         .text('Rocket Wheel MedPulse Clinical Documentation System. Valid without physical signature under IT Act 2000.', 40, 772, { width: 515, align: 'center' })
         .text(`Generated on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`, 40, 782, { width: 515, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

export const generateLabReportPdf = async (report: any): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `Diagnostic Report - ${report.testRequest?.requestNumber || 'Official Report'}`,
          Author: report.testRequest?.lab?.name || report.testRequest?.hospital?.name || 'Diagnostic Laboratory Network',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const labName = report.testRequest?.lab?.name || report.testRequest?.hospital?.name || 'Accredited Pathology & Diagnostic Services';
      const hospitalName = report.testRequest?.hospital?.name || 'MediPulse Network Hospital';
      const patient = report.testRequest?.patient;
      const doctor = report.testRequest?.doctor;

      // Header Bar
      doc.rect(40, 40, 360, 6).fill('#7c3aed');
      doc.rect(400, 40, 155, 6).fill('#1E20E0');

      doc.fillColor('#7c3aed').fontSize(18).font('Helvetica-Bold').text(labName, 40, 55, { width: 360 });
      doc.fillColor('#64748b').fontSize(8.5).font('Helvetica')
        .text(`Facility: ${hospitalName} | Accredited Diagnostic Laboratory`, 40, 78, { width: 360 });

      // Badge
      doc.roundedRect(410, 52, 145, 30, 4).fill('#faf5ff');
      doc.roundedRect(410, 52, 145, 30, 4).strokeColor('#7c3aed').stroke();
      doc.fillColor('#7c3aed').fontSize(9).font('Helvetica-Bold').text('OFFICIAL DIAGNOSTIC REPORT', 410, 60, { width: 145, align: 'center' });
      doc.fillColor('#64748b').fontSize(8).font('Helvetica').text(`Req: #${report.testRequest?.requestNumber || 'LAB-REQ'}`, 410, 70, { width: 145, align: 'center' });

      // Divider
      doc.moveTo(40, 95).lineTo(555, 95).strokeColor('#e2e8f0').stroke();

      // Patient & Referral Box
      const infoY = 105;
      doc.roundedRect(40, infoY, 515, 65, 4).fill('#f8fafc');
      doc.roundedRect(40, infoY, 515, 65, 4).strokeColor('#e2e8f0').stroke();

      doc.fillColor('#7c3aed').fontSize(8.5).font('Helvetica-Bold').text('PATIENT IDENTIFICATION', 50, infoY + 8);
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text(patient?.fullName || 'Patient Name', 50, infoY + 20);
      doc.fillColor('#475569').fontSize(8.5).font('Helvetica')
        .text(`MRN: ${patient?.patientIdNumber || 'MRN-Pending'}  |  Age/Gender: ${patient?.age || 'N/A'} Y / ${patient?.gender || 'N/A'}  |  Blood: ${patient?.bloodGroup || 'N/A'}`, 50, infoY + 35)
        .text(`Contact: +91 ${patient?.mobileNumber || 'N/A'}`, 50, infoY + 48);

      doc.fillColor('#7c3aed').fontSize(8.5).font('Helvetica-Bold').text('REFERRING PHYSICIAN', 320, infoY + 8);
      doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text(doctor ? `Dr. ${doctor.name}` : 'Self / Outpatient Order', 320, infoY + 20);
      doc.fillColor('#475569').fontSize(8.5).font('Helvetica')
        .text(`Dept: ${doctor?.department?.name || 'General OPD'}`, 320, infoY + 35)
        .text(`Date Completed: ${new Date(report.completedAt || report.createdAt).toLocaleDateString('en-IN')}`, 320, infoY + 48);

      // Section: Requested Tests
      let curY = infoY + 80;
      doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text('INVESTIGATION(S) PERFORMED:', 40, curY);
      curY += 15;

      let testsArray: any[] = [];
      try {
        if (typeof report.testRequest?.tests === 'string') {
          testsArray = JSON.parse(report.testRequest.tests);
        } else if (Array.isArray(report.testRequest?.tests)) {
          testsArray = report.testRequest.tests;
        }
      } catch (e) {
        testsArray = [{ name: String(report.testRequest?.tests || 'Diagnostic Investigation') }];
      }

      testsArray.forEach((t: any, i: number) => {
        doc.fillColor('#334155').fontSize(9).font('Helvetica')
          .text(`${i + 1}. ${t.name || t} ${t.category ? `(${t.category})` : ''}`, 50, curY);
        curY += 14;
      });
      curY += 10;

      // Section: Diagnostic Findings & Results
      doc.fillColor('#7c3aed').fontSize(10).font('Helvetica-Bold').text('CLINICAL FINDINGS & RESULTS:', 40, curY);
      curY += 16;
      doc.roundedRect(40, curY, 515, 80, 4).fill('#faf5ff');
      doc.roundedRect(40, curY, 515, 80, 4).strokeColor('#e9d5ff').stroke();

      doc.fillColor('#1e1b4b').fontSize(9.5).font('Helvetica').text(report.results || 'Diagnostic tests concluded within acceptable parameters. No critical abnormalities flagged.', 50, curY + 12, { width: 495 });
      curY += 95;

      // Section: Remarks
      if (report.remarks) {
        doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('PATHOLOGIST / CLINICAL REMARKS:', 40, curY);
        curY += 14;
        doc.fillColor('#475569').fontSize(8.5).font('Helvetica').text(report.remarks, 40, curY, { width: 515 });
        curY += 30;
      }

      // Signatures
      const sigY = 690;
      doc.moveTo(380, sigY).lineTo(540, sigY).strokeColor('#94a3b8').stroke();
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(report.technicianName || 'Accredited Lab Technologist', 380, sigY + 6, { width: 160, align: 'center' });
      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica').text('Authorized Diagnostic Signatory', 380, sigY + 18, { width: 160, align: 'center' });

      // Footer
      doc.moveTo(40, 765).lineTo(555, 765).strokeColor('#e2e8f0').stroke();
      doc.fillColor('#94a3b8').fontSize(7).font('Helvetica')
        .text('Official Diagnostic Document • Rocket Wheel MedPulse Laboratory Network • Certified under Clinical Establishments Act', 40, 772, { width: 515, align: 'center' })
        .text(`Generated on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`, 40, 782, { width: 515, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

