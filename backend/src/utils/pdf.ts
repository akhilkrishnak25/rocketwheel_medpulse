import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import {
  formatBP,
  formatPulse,
  formatTemperature,
  formatSpO2,
  formatWeight,
  formatHeight,
  calculateBMI,
  formatRespiratoryRate,
} from './vitals';
import { sortMedicinesByPriority } from './medicines';

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

export interface HospitalBrandingData {
  headerImageUrl?: string | null; // Full hospital header banner/letterhead image
  footerImageUrl?: string | null; // Full hospital footer banner/disclaimer image
  headerLogoUrl?: string | null;
  logoUrl?: string | null;
  hospitalName?: string | null;
  address?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  website?: string | null;
  regDetails?: string | null;
  headerStyle?: string | null; // CLASSIC, MODERN, MINIMAL
  footerText?: string | null;
  footerPhone?: string | null;
  footerEmail?: string | null;
  disclaimer?: string | null;
  showPageNumbers?: boolean;
  watermarkEnabled?: boolean;
  watermarkType?: string; // TEXT, IMAGE
  watermarkText?: string | null;
  watermarkImageUrl?: string | null;
  watermarkOpacity?: number;
  watermarkSize?: number;
  watermarkPosition?: string;
  watermarkRotation?: number;
}

export function resolveImageBuffer(imgSrc?: string | null): Buffer | null {
  if (!imgSrc || typeof imgSrc !== 'string') return null;
  try {
    if (imgSrc.startsWith('data:image/')) {
      const b64 = imgSrc.replace(/^data:image\/\w+;base64,/, '');
      return Buffer.from(b64, 'base64');
    }
    const cleanPath = imgSrc.replace(/^\//, '');
    const candidatePaths = [
      imgSrc,
      path.join(process.cwd(), cleanPath),
      path.join(process.cwd(), 'backend', cleanPath),
      path.join(__dirname, '..', '..', cleanPath),
      path.join(__dirname, '..', '..', '..', cleanPath),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        return fs.readFileSync(p);
      }
    }
  } catch {
    return null;
  }
  return null;
}

export interface ClinicalConsultationPdfData {
  appointmentNumber: string;
  consultationDate: string;
  tokenNumber?: number;
  letterheadHeight?: number; // Configurable blank hospital letterhead height in points (default: 144 = 2 inches)
  branding?: HospitalBrandingData | null;
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
    registrationNumber?: string;
    headerImageUrl?: string | null;
    footerImageUrl?: string | null;
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
  examination?: string | null;
  vitals?: {
    bp?: string | null;
    pulse?: string | number | null;
    temperature?: string | number | null;
    spo2?: string | number | null;
    weight?: string | number | null;
    height?: string | number | null;
    respiratoryRate?: string | number | null;
    bmi?: string | null;
  } | null;
  diagnosis?: string | null;
  medicines?: Array<{
    name: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
    priority?: number | string | null;
    isSubstituted?: boolean;
    originalMedicine?: string;
    substitutionReason?: string;
  }>;
  labRequests?: Array<{
    name: string;
    status: string;
    category?: string;
  }>;
  clinicalNotes?: string | null;
  instructions?: string | null;
  followUpDate?: string | null;
  compress?: boolean;
}

function formatPdfFollowUpDate(dateStr?: string | null): string {
  if (!dateStr || !dateStr.trim()) return '';
  const trimmed = dateStr.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    return `${ymdMatch[3]}/${ymdMatch[2]}/${ymdMatch[1]}`;
  }
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return trimmed;
}

function getInvestigationStatus(status?: string): { label: string; textColor: string; bgColor: string } {
  const s = (status || 'PENDING').toUpperCase().trim();
  if (s === 'COMPLETED') {
    return { label: 'COMPLETED', textColor: '#15803d', bgColor: '#dcfce7' };
  }
  if (s === 'SAMPLE_COLLECTED' || s === 'SAMPLE COLLECTED') {
    return { label: 'SAMPLE COLLECTED', textColor: '#0369a1', bgColor: '#e0f2fe' };
  }
  if (s === 'PROCESSING' || s === 'IN_PROGRESS' || s === 'IN PROGRESS') {
    return { label: 'IN PROGRESS', textColor: '#4338ca', bgColor: '#e0e7ff' };
  }
  if (s === 'CANCELLED' || s === 'CANCELED') {
    return { label: 'CANCELLED', textColor: '#64748b', bgColor: '#f1f5f9' };
  }
  return { label: 'PENDING', textColor: '#b45309', bgColor: '#fef3c7' };
}

export const generateClinicalConsultationPdf = async (data: ClinicalConsultationPdfData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        compress: data.compress ?? true,
        info: {
          Title: `Prescription & Clinical Consultation - ${data.patient.fullName}`,
          Author: data.hospital.name,
          Subject: 'Official Consultation Summary & Prescription',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });

      let pageNumber = 1;

      // Fallback Logic for Consultation PDF Header & Footer Images:
      // Priority 1: Respective Doctor's configured custom header/footer images
      // Priority 2 (Fallback): Hospital Admin's configured branding header/footer images
      // Priority 3: null (generate without image, fallback to standard letterhead / text footer)
      const effectiveHeaderSrc = data.doctor?.headerImageUrl || data.branding?.headerImageUrl || null;
      const headerBuffer = resolveImageBuffer(effectiveHeaderSrc);

      const effectiveFooterSrc = data.doctor?.footerImageUrl || data.branding?.footerImageUrl || null;
      const footerBuffer = resolveImageBuffer(effectiveFooterSrc);

      // Calculate Header Image dimensions preserving aspect ratio without distortion
      let headerRenderH = 80;
      let headerRenderW = 515;
      let headerRenderX = 40;
      let headerRenderY = 20;

      if (headerBuffer) {
        try {
          const hImg = (doc as any).openImage(headerBuffer);
          if (hImg && hImg.width && hImg.height) {
            const aspect = hImg.width / hImg.height;
            let w = 515;
            let h = w / aspect;
            if (h > 125) {
              h = 125;
              w = h * aspect;
            }
            headerRenderW = w;
            headerRenderH = h;
            headerRenderX = 40 + (515 - w) / 2;
          }
        } catch {
          headerRenderH = 80;
          headerRenderW = 515;
          headerRenderX = 40;
        }
      }

      // Calculate Footer Image dimensions preserving aspect ratio without distortion
      let footerRenderH = 45;
      let footerRenderW = 515;
      let footerRenderX = 40;
      let footerRenderY = 841.89 - 20 - 45;

      if (footerBuffer) {
        try {
          const fImg = (doc as any).openImage(footerBuffer);
          if (fImg && fImg.width && fImg.height) {
            const aspect = fImg.width / fImg.height;
            let w = 515;
            let h = w / aspect;
            if (h > 75) {
              h = 75;
              w = h * aspect;
            }
            footerRenderW = w;
            footerRenderH = h;
            footerRenderX = 40 + (515 - w) / 2;
            footerRenderY = 841.89 - 20 - h;
          }
        } catch {
          footerRenderH = 45;
          footerRenderW = 515;
          footerRenderX = 40;
          footerRenderY = 841.89 - 20 - 45;
        }
      }

      const renderWatermark = () => {
        const b = data.branding;
        if (!b) return;
        const isWmEnabled = b.watermarkEnabled !== undefined
          ? b.watermarkEnabled
          : Boolean(b.watermarkType && b.watermarkType !== 'NONE');
        if (!isWmEnabled) return;
        try {
          doc.save();
          const opacity = typeof b.watermarkOpacity === 'number' ? b.watermarkOpacity : 0.08;
          doc.opacity(Math.max(0.01, Math.min(1, opacity)));

          const centerX = 297.64; // A4 width 595.28 / 2
          const centerY = 420.95; // A4 height 841.89 / 2
          const rotation = typeof b.watermarkRotation === 'number' ? b.watermarkRotation : -30;

          if (b.watermarkType === 'IMAGE' && b.watermarkImageUrl) {
            const imgBuffer = resolveImageBuffer(b.watermarkImageUrl);
            if (imgBuffer) {
              doc.rotate(rotation, { origin: [centerX, centerY] });
              const scale = b.watermarkSize || 50;
              const imgW = Math.max(80, Math.min(450, scale * 4));
              doc.image(imgBuffer, centerX - imgW / 2, centerY - imgW / 2, { width: imgW });
            }
          } else {
            const wmText = (
              b.watermarkText ||
              b.hospitalName ||
              data.hospital.name ||
              'CONFIDENTIAL'
            ).toUpperCase();
            const fontSize = Math.max(16, Math.min(84, b.watermarkSize || 48));
            doc.rotate(rotation, { origin: [centerX, centerY] });
            doc.fontSize(fontSize).font('Helvetica-Bold').fillColor('#64748b');
            const textWidth = doc.widthOfString(wmText);
            doc.text(wmText, centerX - textWidth / 2, centerY - fontSize / 2, { lineBreak: false });
          }
          doc.restore();
        } catch {
          // ignore watermark rendering error
        }
      };

      const renderPageFooter = () => {
        if (footerBuffer) {
          try {
            doc.image(footerBuffer, footerRenderX, footerRenderY, {
              width: footerRenderW,
              height: footerRenderH,
            });
          } catch (e) {
            console.warn('Failed to render footer image in PDF:', e);
          }
        } else {
          doc.moveTo(40, 768).lineTo(555, 768).strokeColor('#e2e8f0').stroke();
          const footerText = data.branding?.footerText || 'Rocket Wheel MedPulse Clinical Documentation System • Valid without physical signature under IT Act 2000.';
          doc.fillColor('#64748b').fontSize(7).font('Helvetica')
             .text(footerText, 40, 774, { width: 515, align: 'center' });

          if (data.branding?.disclaimer) {
            doc.fillColor('#94a3b8').fontSize(6.5).font('Helvetica')
               .text(data.branding.disclaimer, 40, 784, { width: 515, align: 'center' });
          }

          const genTime = `Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`;
          const contactInfo = [
            data.branding?.footerPhone ? `Helpline: ${data.branding.footerPhone}` : '',
            data.branding?.footerEmail ? `Email: ${data.branding.footerEmail}` : '',
          ].filter(Boolean).join(' | ');

          const pageStr = data.branding?.showPageNumbers !== false ? `Page ${pageNumber}` : '';
          const bottomLine = [contactInfo, genTime, pageStr].filter(Boolean).join(' • ');

          doc.fillColor('#94a3b8').fontSize(6.5).font('Helvetica')
             .text(bottomLine, 40, data.branding?.disclaimer ? 794 : 784, { width: 515, align: 'center' });
        }
      };

      const renderRunningHeader = () => {
        const hospName = data.branding?.hospitalName || data.hospital.name;
        doc.fillColor('#1E20E0').fontSize(8).font('Helvetica-Bold')
           .text(hospName, 40, 36, { width: 250 });
        doc.fillColor('#64748b').fontSize(7.5).font('Helvetica')
           .text(
             `Clinical Consultation • Patient: ${data.patient.fullName} (${data.patient.patientIdNumber || 'OPD'}) • OP #${data.appointmentNumber}`,
             40,
             36,
             { width: 515, align: 'right' }
           );
        doc.moveTo(40, 48).lineTo(555, 48).strokeColor('#e2e8f0').stroke();
      };

      const pageBottomLimit = footerBuffer ? (footerRenderY - 8) : 758;
      const checkPageBreak = (neededHeight: number): boolean => {
        if (curY + neededHeight > pageBottomLimit) {
          renderPageFooter();
          doc.addPage({ size: 'A4', margin: 40 });
          pageNumber++;
          renderWatermark();
          if (headerBuffer) {
            try {
              doc.image(headerBuffer, headerRenderX, headerRenderY, {
                width: headerRenderW,
                height: headerRenderH,
              });
            } catch {}
            curY = headerRenderY + headerRenderH + 12;
          } else {
            renderRunningHeader();
            curY = 56;
          }
          return true;
        }
        return false;
      };

      // ----------------------------------------------------------------------
      // 1. HOSPITAL BRANDING & LETTERHEAD HEADER (Page 1)
      // ----------------------------------------------------------------------
      renderWatermark();

      let infoTop = 144;
      if (headerBuffer) {
        try {
          doc.image(headerBuffer, headerRenderX, headerRenderY, {
            width: headerRenderW,
            height: headerRenderH,
          });
        } catch (e) {
          console.warn('Failed to render header image in PDF:', e);
        }
        infoTop = headerRenderY + headerRenderH + 12;
      } else if (data.branding) {
        const hospName = data.branding.hospitalName || data.hospital.name;
        const hospAddr = data.branding.address || `${data.hospital.address}, ${data.hospital.city}`;
        const hospPhone = data.branding.contactPhone || (data.branding as any).phone || data.hospital.phone;
        const hospEmail = data.branding.contactEmail || (data.branding as any).email || data.hospital.email;
        const hospWeb = data.branding.website;
        const hospReg = data.branding.regDetails;

        // Top decorative accent bar
        doc.rect(40, 28, 360, 4).fill('#1E20E0');
        doc.rect(400, 28, 155, 4).fill('#FF1D6B');

        const logoBuffer = resolveImageBuffer(data.branding.headerLogoUrl || (data.branding as any).logoUrl);
        const hasLogo = !!logoBuffer;
        const textStartX = hasLogo ? 104 : 40;
        const textWidth = hasLogo ? 451 : 515;

        if (hasLogo && logoBuffer) {
          try {
            doc.image(logoBuffer, 40, 38, { fit: [54, 54], align: 'center', valign: 'center' });
          } catch {
            // safely ignore if logo image parsing fails
          }
        }

        doc.fillColor('#1E20E0').fontSize(14).font('Helvetica-Bold')
           .text(hospName, textStartX, 38, { width: textWidth });

        doc.fillColor('#475569').fontSize(8).font('Helvetica')
           .text(hospAddr, textStartX, 54, { width: textWidth });

        const contactParts = [
          hospPhone ? `Tel: ${hospPhone}` : '',
          hospEmail ? `Email: ${hospEmail}` : '',
          hospWeb ? `Web: ${hospWeb}` : '',
        ].filter(Boolean).join(' | ');

        if (contactParts) {
          doc.fillColor('#64748b').fontSize(7.5).font('Helvetica')
             .text(contactParts, textStartX, 66, { width: textWidth });
        }

        if (hospReg) {
          doc.fillColor('#0284c7').fontSize(7.5).font('Helvetica-Bold')
             .text(hospReg, textStartX, contactParts ? 77 : 66, { width: textWidth });
        }

        const headerBottom = hospReg && contactParts ? 94 : (contactParts ? 84 : 76);
        doc.moveTo(40, headerBottom).lineTo(555, headerBottom).strokeColor('#cbd5e1').stroke();
        infoTop = headerBottom + 10;
      } else {
        const letterheadHeight = typeof data.letterheadHeight === 'number' && data.letterheadHeight >= 0
          ? data.letterheadHeight
          : 144;
        infoTop = letterheadHeight;
      }

      // ----------------------------------------------------------------------
      // 2. HIGHLIGHT DOCTOR AND PATIENT DETAILS USING SEPARATE BOXES
      // ----------------------------------------------------------------------
      const boxWidth = 250;
      const leftColX = 40;
      const rightColX = 305;

      // Doctor Box Content
      const doctorTitle = 'CONSULTING PHYSICIAN';
      const rawDocName = (data.doctor.name || '').trim();
      const cleanDocName = rawDocName.replace(/^(dr\.?|doctor)\s+/i, '');
      const doctorName = `Dr. ${cleanDocName || 'Physician'}`;
      const docQualSpec = [data.doctor.qualification, data.doctor.specialization].filter(Boolean).join(' • ') || 'General Practitioner';
      const docDept = `Dept: ${data.doctor.department || 'General Medicine'}`;
      const docReg = data.doctor.registrationNumber ? `Reg No: ${data.doctor.registrationNumber}` : null;

      // Patient Box Content
      const patientTitle = 'PATIENT PARTICULARS';
      const patientName = data.patient.fullName;
      const ageText = data.patient.age ? `${data.patient.age} Yrs` : 'N/A';
      const genderText = data.patient.gender || 'Not Specified';
      const bloodText = data.patient.bloodGroup ? `Blood: ${data.patient.bloodGroup}` : 'Blood: Not specified';
      const patLine1 = `Age / Gender: ${ageText} / ${genderText}  |  ${bloodText}`;
      const mrnText = data.patient.patientIdNumber || 'MRN-Pending';
      const patLine2 = `MRN: ${mrnText}  |  Mobile: +91 ${data.patient.mobileNumber}`;

      // Measure required heights to balance both boxes
      doc.fontSize(8.5).font('Helvetica');
      const docQualH = doc.heightOfString(docQualSpec, { width: boxWidth - 16 });
      const docHeight = 22 + 15 + docQualH + 13 + (docReg ? 13 : 0) + 8;
      const patHeight = 22 + 15 + 13 + 13 + 8;
      const boxHeight = Math.max(docHeight, patHeight, 72);

      // Render Doctor Box
      doc.roundedRect(leftColX, infoTop, boxWidth, boxHeight, 4).fill('#f8fafc');
      doc.roundedRect(leftColX, infoTop, boxWidth, boxHeight, 4).strokeColor('#cbd5e1').stroke();
      doc.fillColor('#1E20E0').fontSize(8.5).font('Helvetica-Bold').text(doctorTitle, leftColX + 8, infoTop + 7);
      doc.fillColor('#0f172a').fontSize(10.5).font('Helvetica-Bold').text(doctorName, leftColX + 8, infoTop + 19, { width: boxWidth - 16 });
      let docTextY = infoTop + 33;
      doc.fillColor('#334155').fontSize(8.5).font('Helvetica').text(docQualSpec, leftColX + 8, docTextY, { width: boxWidth - 16 });
      docTextY += docQualH + 2;
      doc.text(docDept, leftColX + 8, docTextY, { width: boxWidth - 16 });
      if (docReg) {
        docTextY += 12;
        doc.fillColor('#64748b').fontSize(8).font('Helvetica').text(docReg, leftColX + 8, docTextY, { width: boxWidth - 16 });
      }

      // Render Patient Box
      doc.roundedRect(rightColX, infoTop, boxWidth, boxHeight, 4).fill('#f8fafc');
      doc.roundedRect(rightColX, infoTop, boxWidth, boxHeight, 4).strokeColor('#cbd5e1').stroke();
      doc.fillColor('#1E20E0').fontSize(8.5).font('Helvetica-Bold').text(patientTitle, rightColX + 8, infoTop + 7);
      doc.fillColor('#0f172a').fontSize(10.5).font('Helvetica-Bold').text(patientName, rightColX + 8, infoTop + 19, { width: boxWidth - 16 });
      doc.fillColor('#334155').fontSize(8.5).font('Helvetica')
         .text(patLine1, rightColX + 8, infoTop + 33, { width: boxWidth - 16 })
         .text(patLine2, rightColX + 8, infoTop + 48, { width: boxWidth - 16 });

      let curY = infoTop + boxHeight + 10;

      // ----------------------------------------------------------------------
      // 3. CLINICAL SECTIONS IN EXACT ORDER (1 TO 8)
      // ----------------------------------------------------------------------

      // ----------------------------------------------------------------------
      // Section 1: CLINICAL VITALS
      // ----------------------------------------------------------------------
      const rawV = data.vitals;
      const formattedBP = formatBP(rawV?.bp);
      const formattedPulse = formatPulse(rawV?.pulse);
      const formattedTemp = formatTemperature(rawV?.temperature);
      const formattedSpO2 = formatSpO2(rawV?.spo2);
      const formattedWeight = formatWeight(rawV?.weight);
      const formattedHeight = formatHeight(rawV?.height);
      const formattedResp = formatRespiratoryRate(rawV?.respiratoryRate);
      const bmiCalc = rawV?.bmi || calculateBMI(rawV?.weight, rawV?.height);

      const vitalsList: string[] = [];
      if (formattedBP) vitalsList.push(`BP: ${formattedBP}`);
      if (formattedPulse) vitalsList.push(`Pulse: ${formattedPulse}`);
      if (formattedTemp) vitalsList.push(`Temp: ${formattedTemp}`);
      if (formattedSpO2) vitalsList.push(`SpO2: ${formattedSpO2}`);
      if (formattedResp) vitalsList.push(`Resp: ${formattedResp}`);
      if (formattedWeight) vitalsList.push(`Weight: ${formattedWeight}`);
      if (formattedHeight) vitalsList.push(`Height: ${formattedHeight}`);
      if (bmiCalc) vitalsList.push(`BMI: ${bmiCalc}`);

      if (vitalsList.length > 0) {
        const vitalsStr = vitalsList.join('   |   ');
        doc.fontSize(8.5).font('Helvetica');
        const vitalsTextH = doc.heightOfString(vitalsStr, { width: 380, lineGap: 2 });
        const vitalsBoxH = Math.max(26, vitalsTextH + 14);

        checkPageBreak(vitalsBoxH + 6);
        doc.roundedRect(40, curY, 515, vitalsBoxH, 4).fill('#f1f5f9');
        doc.roundedRect(40, curY, 515, vitalsBoxH, 4).strokeColor('#cbd5e1').stroke();
        doc.fillColor('#1E20E0').fontSize(8.5).font('Helvetica-Bold').text('CLINICAL VITALS:', 48, curY + 7);
        doc.fillColor('#1e293b').fontSize(8.5).font('Helvetica').text(vitalsStr, 140, curY + 7, { width: 405, lineGap: 2 });
        curY += vitalsBoxH + 8;
      }

      // ----------------------------------------------------------------------
      // Section 2: CHIEF COMPLAINTS / SYMPTOMS
      // ----------------------------------------------------------------------
      if (data.chiefComplaints && data.chiefComplaints.trim()) {
        const text = data.chiefComplaints.trim();
        doc.fontSize(8.5).font('Helvetica');
        const textH = doc.heightOfString(text, { width: 515, lineGap: 2 });
        checkPageBreak(textH + 20);

        doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('CHIEF COMPLAINTS / SYMPTOMS:', 40, curY);
        curY += 13;
        doc.fillColor('#334155').fontSize(8.5).font('Helvetica').text(text, 40, curY, { width: 515, lineGap: 2 });
        curY += textH + 8;
      }

      // ----------------------------------------------------------------------
      // Section 3: EXAMINATION (Clinical Examination Findings)
      // ----------------------------------------------------------------------
      if (data.examination && data.examination.trim()) {
        const text = data.examination.trim();
        doc.fontSize(8.5).font('Helvetica');
        const textH = doc.heightOfString(text, { width: 515, lineGap: 2 });
        checkPageBreak(textH + 20);

        doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('EXAMINATION / CLINICAL FINDINGS:', 40, curY);
        curY += 13;
        doc.fillColor('#334155').fontSize(8.5).font('Helvetica').text(text, 40, curY, { width: 515, lineGap: 2 });
        curY += textH + 8;
      }

      // ----------------------------------------------------------------------
      // Section 4: PROVISIONAL DIAGNOSIS
      // ----------------------------------------------------------------------
      if (data.diagnosis && data.diagnosis.trim()) {
        const text = data.diagnosis.trim();
        doc.fontSize(9.5).font('Helvetica');
        const textH = doc.heightOfString(text, { width: 515, lineGap: 2 });
        checkPageBreak(textH + 20);

        doc.fillColor('#1E20E0').fontSize(9).font('Helvetica-Bold').text('PROVISIONAL DIAGNOSIS:', 40, curY);
        curY += 13;
        doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold').text(text, 40, curY, { width: 515, lineGap: 2 });
        curY += textH + 8;
      }

      // ----------------------------------------------------------------------
      // Section 5: DIAGNOSTIC INVESTIGATIONS / RADIOLOGY
      // (Cancelled tests excluded; status column and labels completely omitted)
      // ----------------------------------------------------------------------
      const activeLabRequests = (data.labRequests || []).filter((req) => {
        const s = (req.status || '').toUpperCase().trim();
        return s !== 'CANCELLED' && s !== 'CANCELED' && s !== 'REJECTED';
      });

      if (activeLabRequests.length > 0) {
        checkPageBreak(30);
        doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('DIAGNOSTIC INVESTIGATIONS / RADIOLOGY:', 40, curY);
        curY += 14;

        activeLabRequests.forEach((req, idx) => {
          const reqCategory = req.category ? ` [${req.category}]` : '';
          const nameWithCategory = `${idx + 1}. ${req.name}${reqCategory}`;

          doc.fontSize(8.5).font('Helvetica');
          const nameH = doc.heightOfString(nameWithCategory, { width: 500, lineGap: 1 });
          const rowH = Math.max(nameH, 14) + 4;

          checkPageBreak(rowH);

          // Name across width, clean test description without status badge/column/labels
          doc.fillColor('#334155').fontSize(8.5).font('Helvetica')
             .text(nameWithCategory, 48, curY, { width: 500, lineGap: 1 });

          curY += rowH;
        });

        curY += 8;
      }

      // ----------------------------------------------------------------------
      // Section 6: PRESCRIPTION (Rx)
      // ----------------------------------------------------------------------
      const renderRxTableHeader = () => {
        doc.roundedRect(40, curY, 515, 20, 2).fill('#1E20E0');
        doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
        doc.text('#', 44, curY + 6, { width: 20, align: 'center' });
        doc.text('MEDICINE NAME', 68, curY + 6, { width: 170 });
        doc.text('DOSAGE', 242, curY + 6, { width: 65 });
        doc.text('FREQUENCY', 311, curY + 6, { width: 75 });
        doc.text('DURATION', 390, curY + 6, { width: 55 });
        doc.text('INSTRUCTIONS', 449, curY + 6, { width: 102 });
        curY += 21;
      };

      if (data.medicines && data.medicines.length > 0) {
        const sortedMedicines = sortMedicinesByPriority(data.medicines);
        const hasSubstituted = sortedMedicines.some((m) => m.isSubstituted);
        checkPageBreak(45);

        doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold').text('PRESCRIPTION (Rx):', 40, curY);
        if (hasSubstituted) {
          doc.fillColor('#b45309').fontSize(7.5).font('Helvetica-Bold')
             .text('• REVISED PRESCRIPTION (Includes authorized pharmacy substitutions)', 160, curY + 2, { align: 'right', width: 395 });
        }
        curY += 14;

        renderRxTableHeader();

        sortedMedicines.forEach((med, idx) => {
          const isSub = Boolean(med.isSubstituted);
          const subNote = isSub
            ? `[Substituted for: ${med.originalMedicine || 'Original Medicine'}${med.substitutionReason ? ` - ${med.substitutionReason}` : ''}]`
            : '';

          doc.fontSize(8).font('Helvetica');
          const medNameH = doc.heightOfString(med.name, { width: 170 });
          const subNoteH = isSub ? doc.heightOfString(subNote, { width: 170, lineGap: 1 }) : 0;
          const instructionsH = doc.heightOfString(med.instructions || 'As advised', { width: 102 });

          const rowHeight = Math.max(medNameH + (isSub ? subNoteH + 3 : 0), instructionsH, 16) + 8;

          // Multi-page pagination check: repeat header on new page
          const broke = checkPageBreak(rowHeight);
          if (broke) {
            renderRxTableHeader();
          }

          // Row background
          const rowBg = isSub ? '#fffbeb' : idx % 2 === 0 ? '#f8fafc' : '#ffffff';
          doc.rect(40, curY, 515, rowHeight).fill(rowBg);

          // Substituted orange indicator accent bar on the left edge
          if (isSub) {
            doc.rect(40, curY, 3, rowHeight).fill('#f59e0b');
          }

          // Subtle bottom border
          doc.moveTo(40, curY + rowHeight).lineTo(555, curY + rowHeight).strokeColor('#e2e8f0').stroke();

          // Cell text
          doc.fillColor('#334155').fontSize(8).font('Helvetica')
             .text(String(idx + 1), 44, curY + 4, { width: 20, align: 'center' });

          // Medicine Name + Substitution Note
          doc.fillColor('#0f172a').font('Helvetica-Bold').text(med.name, 68, curY + 4, { width: 170 }).font('Helvetica');
          if (isSub) {
            doc.fillColor('#b45309').fontSize(6.5).font('Helvetica-Bold')
               .text(subNote, 68, curY + 4 + medNameH + 1, { width: 170, lineGap: 1 });
          }

          // Dosage, Frequency, Duration, Instructions
          doc.fillColor('#334155').fontSize(8).font('Helvetica');
          doc.text(med.dosage || '1 dose', 242, curY + 4, { width: 65 });
          doc.text(med.frequency || '1-0-1', 311, curY + 4, { width: 75 });
          doc.text(med.duration || '5 days', 390, curY + 4, { width: 55 });
          doc.text(med.instructions || 'After food', 449, curY + 4, { width: 102 });

          curY += rowHeight;
        });

        curY += 8;
      }

      // ----------------------------------------------------------------------
      // Section 7: ADVICE / CLINICAL NOTES
      // ----------------------------------------------------------------------
      const adviceContent = (data.instructions || data.clinicalNotes || '').trim();
      if (adviceContent) {
        doc.fontSize(8.5).font('Helvetica');
        const adviceH = doc.heightOfString(adviceContent, { width: 495, lineGap: 2 });
        const adviceBoxH = adviceH + 16;

        checkPageBreak(adviceBoxH + 20);

        doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('ADVICE / CLINICAL NOTES:', 40, curY);
        curY += 13;

        doc.roundedRect(40, curY, 515, adviceBoxH, 4).fill('#f8fafc');
        doc.roundedRect(40, curY, 515, adviceBoxH, 4).strokeColor('#cbd5e1').stroke();
        doc.fillColor('#334155').fontSize(8.5).font('Helvetica')
           .text(adviceContent, 48, curY + 8, { width: 495, lineGap: 2 });

        curY += adviceBoxH + 8;
      }

      // ----------------------------------------------------------------------
      // Section 8: FOLLOW-UP DATE (Clearly Separated Row — Never Overlaps Advice)
      // ----------------------------------------------------------------------
      if (data.followUpDate && data.followUpDate.trim()) {
        const formattedDate = formatPdfFollowUpDate(data.followUpDate);
        checkPageBreak(30);

        doc.roundedRect(40, curY, 515, 24, 4).fill('#f8fafc');
        doc.roundedRect(40, curY, 515, 24, 4).strokeColor('#cbd5e1').stroke();

        doc.fillColor('#1E20E0').fontSize(8.5).font('Helvetica-Bold')
           .text('FOLLOW-UP REVIEW DATE:', 48, curY + 7);
        doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold')
           .text(formattedDate, 205, curY + 7);

        curY += 28;
      }

      // ----------------------------------------------------------------------
      // DOCTOR SIGNATURE AREA (Rendered above footer)
      // ----------------------------------------------------------------------
      const sigBlockH = docQualSpec ? 42 : 32;
      checkPageBreak(sigBlockH + 10);

      // Anchor doctor signature directly above the page footer on the right side
      const sigTop = Math.max(curY + 12, pageBottomLimit - sigBlockH - 12);
      const sigLeft = 370;
      const sigWidth = 185;

      doc.moveTo(sigLeft, sigTop).lineTo(sigLeft + sigWidth, sigTop).strokeColor('#94a3b8').stroke();
      doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold')
         .text(doctorName, sigLeft, sigTop + 5, { width: sigWidth, align: 'center' });

      if (docQualSpec) {
        doc.fillColor('#334155').fontSize(7.5).font('Helvetica')
           .text(docQualSpec, sigLeft, sigTop + 17, { width: sigWidth, align: 'center' });
      }

      const sigRoleText = docReg ? `${docReg} • Authorized Signatory` : 'Authorized Medical Practitioner';
      doc.fillColor('#64748b').fontSize(7).font('Helvetica')
         .text(sigRoleText, sigLeft, sigTop + (docQualSpec ? 28 : 17), { width: sigWidth, align: 'center' });

      // Render footer on the final page
      renderPageFooter();

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
        .text(`MRN: ${patient?.patientIdNumber || 'MRN-Pending'}  |  Age/Gender: ${patient?.age || 'N/A'} Y / ${patient?.gender || 'N/A'}  |  Blood: ${patient?.bloodGroup || 'Not specified'}`, 50, infoY + 35)
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

