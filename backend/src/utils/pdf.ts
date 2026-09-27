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
