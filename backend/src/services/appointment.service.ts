import crypto from 'crypto';
import prisma from '../config/prisma';
import { ENV } from '../config/env';
import { PaymentService } from './payment.service';
import { NotificationService } from './notification.service';
import { generateDigitalOpPdf } from '../utils/pdf';
import { AuditService } from '../utils/audit';

export interface CreateAppointmentDTO {
  hospitalId: string;
  doctorId: string;
  departmentId: string;
  appointmentDate: string; // YYYY-MM-DD
  timeSlot: string;
  patient: {
    fullName: string;
    mobileNumber: string;
    email: string;
    dateOfBirth?: string | null;
    gender?: string | null;
    address?: string | null;
    bloodGroup?: string | null;
    emergencyContact?: string | null;
  };
  notes?: string | null;
}

export class AppointmentService {
  /**
   * Step 1: Create pending appointment and lock the slot
   */
  static async createPendingAppointment(dto: CreateAppointmentDTO) {
    const { hospitalId, doctorId, departmentId, appointmentDate, timeSlot, patient: patientData, notes } = dto;

    // Validate Doctor and Hospital association
    const doctor = await prisma.doctor.findFirst({
      where: { id: doctorId, hospitalId, isActive: true },
      include: { hospital: true, department: true },
    });

    if (!doctor) {
      throw new Error('Doctor not found at the selected hospital or is currently inactive.');
    }

    // Double-booking check: verify if slot is already occupied
    const existing = await prisma.appointment.findFirst({
      where: {
        doctorId,
        appointmentDate,
        timeSlot,
        status: { in: ['CONFIRMED', 'WAITING', 'IN_CONSULTATION', 'COMPLETED'] },
      },
    });

    if (existing) {
      throw new Error('Selected time slot has just been booked by another patient. Please choose a different slot.');
    }

    // Check if another pending booking is active within the last 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const existingPending = await prisma.appointment.findFirst({
      where: {
        doctorId,
        appointmentDate,
        timeSlot,
        status: 'PENDING_PAYMENT',
        createdAt: { gte: tenMinutesAgo },
      },
    });

    if (existingPending) {
      throw new Error('This time slot is temporarily reserved by another patient completing payment. Please try another slot.');
    }

    // Upsert / find patient scoped to this hospital (Hospital-isolated patient records)
    let patient = await prisma.patient.findFirst({
      where: {
        hospitalId,
        OR: [
          { mobileNumber: patientData.mobileNumber },
          ...(patientData.email ? [{ email: patientData.email }] : []),
        ],
      },
    });

    if (!patient) {
      const hospitalCode = doctor.hospital?.code || 'HOSP';
      const patientCount = await prisma.patient.count({ where: { hospitalId } });
      const patientIdNumber = `MRN-${hospitalCode}-${String(patientCount + 1).padStart(5, '0')}`;

      patient = await prisma.patient.create({
        data: {
          hospitalId,
          patientIdNumber,
          fullName: patientData.fullName,
          mobileNumber: patientData.mobileNumber,
          email: patientData.email || '',
          dateOfBirth: patientData.dateOfBirth,
          gender: patientData.gender,
          address: patientData.address,
          bloodGroup: patientData.bloodGroup,
          emergencyContact: patientData.emergencyContact,
        },
      });
    } else {
      // Update patient profile with any newly provided details
      patient = await prisma.patient.update({
        where: { id: patient.id },
        data: {
          fullName: patientData.fullName,
          dateOfBirth: patientData.dateOfBirth || patient.dateOfBirth,
          gender: patientData.gender || patient.gender,
          address: patientData.address || patient.address,
          bloodGroup: patientData.bloodGroup || patient.bloodGroup,
          emergencyContact: patientData.emergencyContact || patient.emergencyContact,
        },
      });
    }

    // Calculate queue token number for this doctor on this day
    const dayAppointmentsCount = await prisma.appointment.count({
      where: {
        doctorId,
        appointmentDate,
        status: { in: ['CONFIRMED', 'WAITING', 'IN_CONSULTATION', 'COMPLETED'] },
      },
    });
    const tokenNumber = dayAppointmentsCount + 1;

    // Generate readable appointment number
    const dateFormatted = appointmentDate.replace(/-/g, '');
    const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase();
    const appointmentNumber = `APT-${dateFormatted}-${randomHex}`;

    const consultationFee = doctor.consultationFee;
    const platformFee = ENV.PLATFORM_FEE;
    const totalAmount = consultationFee + platformFee;

    // Create appointment in PENDING_PAYMENT status
    const appointment = await prisma.appointment.create({
      data: {
        appointmentNumber,
        hospitalId,
        doctorId,
        patientId: patient.id,
        departmentId,
        appointmentDate,
        timeSlot,
        tokenNumber,
        status: 'PENDING_PAYMENT',
        bookingType: 'ONLINE',
        consultationFee,
        platformFee,
        totalAmount,
        notes,
      },
      include: {
        hospital: true,
        doctor: true,
        patient: true,
        department: true,
      },
    });

    // Create Razorpay Order
    const razorpayOrder = await PaymentService.createOrder({
      appointmentId: appointment.id,
      amount: totalAmount,
      currency: 'INR',
      receipt: appointmentNumber,
    });

    return {
      appointment,
      paymentOrder: razorpayOrder,
    };
  }

  /**
   * Step 2: Confirm appointment upon verified payment (idempotent)
   */
  static async confirmAppointmentPayment(params: {
    appointmentId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    const { appointmentId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = params;

    // Fetch appointment with all relations
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        hospital: true,
        doctor: true,
        patient: true,
        department: true,
        payment: true,
        digitalOp: true,
      },
    });

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    // Idempotency: If already confirmed, return existing data safely
    if (appointment.status === 'CONFIRMED' && appointment.digitalOp) {
      return {
        appointment,
        digitalOp: appointment.digitalOp,
        alreadyConfirmed: true,
      };
    }

    // Verify Razorpay HMAC SHA256 signature
    const isValid = PaymentService.verifySignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });

    if (!isValid) {
      // Record payment failure
      await prisma.payment.upsert({
        where: { appointmentId },
        update: {
          status: 'FAILED',
          failureReason: 'Invalid Razorpay payment signature',
        },
        create: {
          appointmentId,
          razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature,
          amount: appointment.totalAmount,
          currency: 'INR',
          status: 'FAILED',
          failureReason: 'Invalid Razorpay payment signature',
          idempotencyKey: `fail_${appointmentId}_${Date.now()}`,
        },
      });

      throw new Error('Payment signature verification failed. The transaction could not be validated.');
    }

    // Generate unique OP number: OP-YYYY-MMDD-XXXXXX
    const dateParts = appointment.appointmentDate.split('-');
    const yyyy = dateParts[0];
    const mmdd = `${dateParts[1]}${dateParts[2]}`;
    const seq = crypto.randomInt(100000, 999999);
    const opNumber = `OP-${yyyy}-${mmdd}-${seq}`;

    // Cryptographically secure token for public QR verification
    const secureToken = crypto.randomBytes(24).toString('hex');
    const verificationUrl = `${ENV.CLIENT_URL}/verify-op/${secureToken}`;

    // Use transaction for atomic confirmation
    const result = await prisma.$transaction(async (tx) => {
      // 1. Upsert / update payment record
      const payment = await tx.payment.upsert({
        where: { appointmentId },
        update: {
          razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature,
          amount: appointment.totalAmount,
          currency: 'INR',
          status: 'SUCCESS',
          paymentMethod: 'Razorpay Online Gateway',
        },
        create: {
          appointmentId,
          razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature,
          amount: appointment.totalAmount,
          currency: 'INR',
          status: 'SUCCESS',
          paymentMethod: 'Razorpay Online Gateway',
          idempotencyKey: `pay_${appointmentId}_${razorpayPaymentId}`,
        },
      });

      // 2. Update appointment status to CONFIRMED
      const confirmedApt = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: 'CONFIRMED',
        },
        include: {
          hospital: true,
          doctor: true,
          patient: true,
          department: true,
        },
      });

      // 3. Create Digital OP
      const digitalOp = await tx.digitalOP.create({
        data: {
          opNumber,
          secureToken,
          appointmentId,
          qrData: verificationUrl,
          isVerified: false,
        },
      });

      return { confirmedApt, payment, digitalOp };
    });

    // 4. Send system notification to Hospital Admin
    await NotificationService.notifyHospitalAdminOfBooking({
      hospitalId: result.confirmedApt.hospitalId,
      patientName: result.confirmedApt.patient.fullName,
      patientEmail: result.confirmedApt.patient.email,
      patientMobile: result.confirmedApt.patient.mobileNumber,
      doctorName: result.confirmedApt.doctor.name,
      departmentName: result.confirmedApt.department.name,
      appointmentDate: result.confirmedApt.appointmentDate,
      timeSlot: result.confirmedApt.timeSlot,
      opNumber: result.digitalOp.opNumber,
      totalAmount: result.confirmedApt.totalAmount,
      appointmentId: result.confirmedApt.id,
    });

    return {
      appointment: result.confirmedApt,
      payment: result.payment,
      digitalOp: result.digitalOp,
      alreadyConfirmed: false,
    };
  }

  static async getAppointmentById(id: string) {
    return prisma.appointment.findFirst({
      where: {
        OR: [{ id }, { appointmentNumber: id }],
      },
      include: {
        hospital: true,
        doctor: {
          include: { department: true },
        },
        patient: true,
        department: true,
        payment: true,
        digitalOp: true,
        prescription: true,
      },
    });
  }

  /**
   * QR Code Verification endpoint logic:
   * Returns MINIMUM SAFE INFORMATION as requested:
   * OP number, Patient Name, Hospital, Doctor, Date, Time, Payment Status, Appointment Status
   * Does NOT expose sensitive medical info.
   */
  static async verifyOpToken(secureToken: string) {
    const digitalOp = await prisma.digitalOP.findUnique({
      where: { secureToken },
      include: {
        appointment: {
          include: {
            hospital: { select: { name: true, city: true, phone: true } },
            doctor: { select: { name: true, specialization: true } },
            patient: { select: { fullName: true } },
            payment: { select: { status: true, amount: true } },
          },
        },
      },
    });

    if (!digitalOp) {
      return null;
    }

    // Mark as verified on scan
    await prisma.digitalOP.update({
      where: { id: digitalOp.id },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
      },
    });

    return {
      opNumber: digitalOp.opNumber,
      patientName: digitalOp.appointment.patient.fullName,
      hospital: digitalOp.appointment.hospital.name,
      hospitalCity: digitalOp.appointment.hospital.city,
      hospitalPhone: digitalOp.appointment.hospital.phone,
      doctor: digitalOp.appointment.doctor.name,
      specialization: digitalOp.appointment.doctor.specialization,
      appointmentDate: digitalOp.appointment.appointmentDate,
      timeSlot: digitalOp.appointment.timeSlot,
      tokenNumber: digitalOp.appointment.tokenNumber,
      appointmentStatus: digitalOp.appointment.status,
      paymentStatus: digitalOp.appointment.payment?.status || 'SUCCESS',
      verifiedAt: new Date().toISOString(),
    };
  }

  /**
   * Generates Digital OP PDF buffer
   */
  static async generatePdf(appointmentIdOrOpNumber: string): Promise<Buffer> {
    const appointment = await prisma.appointment.findFirst({
      where: {
        OR: [
          { id: appointmentIdOrOpNumber },
          { appointmentNumber: appointmentIdOrOpNumber },
          { digitalOp: { opNumber: appointmentIdOrOpNumber } },
        ],
      },
      include: {
        hospital: true,
        doctor: {
          include: { department: true },
        },
        patient: true,
        department: true,
        payment: true,
        digitalOp: true,
      },
    });

    if (!appointment || !appointment.digitalOp) {
      throw new Error('Confirmed appointment or Digital OP not found for PDF generation');
    }

    // Increment download count
    await prisma.digitalOP.update({
      where: { id: appointment.digitalOp.id },
      data: { downloadCount: { increment: 1 } },
    });

    return generateDigitalOpPdf({
      opNumber: appointment.digitalOp.opNumber,
      secureToken: appointment.digitalOp.secureToken,
      appointmentNumber: appointment.appointmentNumber,
      appointmentDate: appointment.appointmentDate,
      timeSlot: appointment.timeSlot,
      tokenNumber: appointment.tokenNumber,
      hospital: {
        name: appointment.hospital.name,
        address: appointment.hospital.address,
        city: appointment.hospital.city,
        phone: appointment.hospital.phone,
        emergencyContact: appointment.hospital.emergencyContact,
        email: appointment.hospital.email,
      },
      doctor: {
        name: appointment.doctor.name,
        qualification: appointment.doctor.qualification,
        specialization: appointment.doctor.specialization,
        department: appointment.department.name,
      },
      patient: {
        fullName: appointment.patient.fullName,
        mobileNumber: appointment.patient.mobileNumber,
        email: appointment.patient.email,
        gender: appointment.patient.gender,
        bloodGroup: appointment.patient.bloodGroup,
        ageOrDob: appointment.patient.dateOfBirth,
      },
      payment: {
        amount: appointment.totalAmount,
        paymentId: appointment.payment?.razorpayPaymentId,
        status: appointment.payment?.status || 'SUCCESS',
        method: appointment.payment?.paymentMethod,
      },
      verificationUrl: appointment.digitalOp.qrData,
    });
  }

  /**
   * Queue info for patient:
   * Returns current token in consultation vs patient's token, patients ahead
   */
  static async getQueueStatus(appointmentId: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: { select: { id: true, name: true } },
      },
    });

    if (!appointment) return null;

    // Find the appointment currently IN_CONSULTATION for this doctor today
    const inConsultationApt = await prisma.appointment.findFirst({
      where: {
        doctorId: appointment.doctorId,
        appointmentDate: appointment.appointmentDate,
        status: 'IN_CONSULTATION',
      },
      select: { tokenNumber: true },
    });

    // Alternatively, highest completed token
    const lastCompleted = await prisma.appointment.findFirst({
      where: {
        doctorId: appointment.doctorId,
        appointmentDate: appointment.appointmentDate,
        status: 'COMPLETED',
      },
      orderBy: { tokenNumber: 'desc' },
      select: { tokenNumber: true },
    });

    const currentToken = inConsultationApt?.tokenNumber || (lastCompleted?.tokenNumber ? lastCompleted.tokenNumber + 1 : 1);
    const patientsAhead = Math.max(0, appointment.tokenNumber - currentToken);

    return {
      yourToken: appointment.tokenNumber,
      currentToken: inConsultationApt ? inConsultationApt.tokenNumber : (lastCompleted?.tokenNumber || 0),
      patientsAhead,
      appointmentStatus: appointment.status,
      doctorName: appointment.doctor.name,
    };
  }

  static async cancelAppointment(appointmentId: string, reason: string, requestingUserId?: string) {
    const apt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        hospital: true,
        doctor: true,
        patient: true,
        payment: true,
      },
    });

    if (!apt) throw new Error('Appointment not found');

    if (apt.status === 'COMPLETED') {
      throw new Error('Cannot cancel an appointment that has already been completed.');
    }

    if (apt.status === 'CANCELLED') {
      throw new Error('This appointment has already been cancelled.');
    }

    const cancelled = await prisma.$transaction(async (tx) => {
      // If paid, update payment record to REFUNDED
      if (apt.payment && apt.payment.status === 'SUCCESS') {
        await tx.payment.update({
          where: { appointmentId: apt.id },
          data: {
            status: 'REFUNDED',
            failureReason: `Cancelled: ${reason}`,
          },
        });
      }

      const updated = await tx.appointment.update({
        where: { id: apt.id },
        data: {
          status: 'CANCELLED',
          cancellationReason: reason,
        },
        include: {
          hospital: true,
          doctor: true,
          patient: true,
          payment: true,
        },
      });

      // Notification for Hospital Admin
      await tx.notification.create({
        data: {
          hospitalId: apt.hospitalId,
          recipientType: 'HOSPITAL_ADMIN',
          title: 'Appointment Cancelled',
          message: `Appointment ${apt.appointmentNumber} for patient ${apt.patient.fullName} with ${apt.doctor.name} on ${apt.appointmentDate} at ${apt.timeSlot} was cancelled.\nReason: ${reason}`,
          type: 'APPOINTMENT_CANCELLED',
          metadata: JSON.stringify({
            appointmentId: apt.id,
            appointmentNumber: apt.appointmentNumber,
            reason,
          }),
        },
      });

      return updated;
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'CANCEL_APPOINTMENT',
      entity: 'Appointment',
      entityId: appointmentId,
      details: { reason, appointmentNumber: apt.appointmentNumber },
    });

    return cancelled;
  }

  static async getAppointmentPrescription(idOrOpNumber: string) {
    const apt = await prisma.appointment.findFirst({
      where: {
        OR: [
          { id: idOrOpNumber },
          { appointmentNumber: idOrOpNumber },
          { digitalOp: { opNumber: idOrOpNumber } },
        ],
      },
      include: {
        hospital: true,
        doctor: { include: { department: true } },
        patient: true,
        prescription: true,
        medicalRecord: true,
        digitalOp: true,
      },
    });

    if (!apt) throw new Error('Appointment not found');
    if (!apt.prescription) {
      throw new Error('Prescription not yet available for this appointment. Please check back once consultation is completed.');
    }

    return {
      appointmentNumber: apt.appointmentNumber,
      opNumber: apt.digitalOp?.opNumber,
      appointmentDate: apt.appointmentDate,
      timeSlot: apt.timeSlot,
      patient: {
        fullName: apt.patient.fullName,
        gender: apt.patient.gender,
        ageOrDob: apt.patient.dateOfBirth,
        bloodGroup: apt.patient.bloodGroup,
      },
      doctor: {
        name: apt.doctor.name,
        qualification: apt.doctor.qualification,
        specialization: apt.doctor.specialization,
        department: apt.doctor.department.name,
      },
      hospital: {
        name: apt.hospital.name,
        address: apt.hospital.address,
        city: apt.hospital.city,
        phone: apt.hospital.phone,
      },
      diagnosis: apt.prescription.diagnosis,
      medicines: JSON.parse(apt.prescription.medicines || '[]'),
      instructions: apt.prescription.instructions,
      followUpDate: apt.prescription.followUpDate,
      vitals: apt.medicalRecord ? JSON.parse(apt.medicalRecord.vitals || '{}') : null,
      createdAt: apt.prescription.createdAt,
    };
  }

  /**
   * Create Offline / Walk-in appointment directly in CONFIRMED state
   */
  static async createOfflineAppointment(dto: {
    hospitalId: string;
    doctorId: string;
    departmentId: string;
    appointmentDate: string;
    timeSlot?: string;
    patient: {
      fullName: string;
      mobileNumber: string;
      email?: string | null;
      dateOfBirth?: string | null;
      gender?: string | null;
      age?: number | null;
      address?: string | null;
      bloodGroup?: string | null;
      emergencyContact?: string | null;
    };
    notes?: string | null;
    consultationFee?: number;
    requestingUserId?: string;
  }) {
    const { hospitalId, doctorId, departmentId, appointmentDate, timeSlot, patient: patientData, notes, consultationFee: customFee, requestingUserId } = dto;

    const doctor = await prisma.doctor.findFirst({
      where: { id: doctorId, hospitalId, isActive: true },
      include: { hospital: true, department: true },
    });

    if (!doctor) {
      throw new Error('Doctor not found at this hospital or is inactive.');
    }

    // Scoped patient lookup/create
    let patient = await prisma.patient.findFirst({
      where: {
        hospitalId,
        OR: [
          { mobileNumber: patientData.mobileNumber },
          ...(patientData.email ? [{ email: patientData.email }] : []),
        ],
      },
    });

    if (!patient) {
      const hospitalCode = doctor.hospital?.code || 'HOSP';
      const patientCount = await prisma.patient.count({ where: { hospitalId } });
      const patientIdNumber = `MRN-${hospitalCode}-${String(patientCount + 1).padStart(5, '0')}`;

      patient = await prisma.patient.create({
        data: {
          hospitalId,
          patientIdNumber,
          fullName: patientData.fullName,
          mobileNumber: patientData.mobileNumber,
          email: patientData.email || '',
          dateOfBirth: patientData.dateOfBirth,
          gender: patientData.gender,
          address: patientData.address,
          bloodGroup: patientData.bloodGroup,
          emergencyContact: patientData.emergencyContact,
        },
      });
    } else {
      patient = await prisma.patient.update({
        where: { id: patient.id },
        data: {
          fullName: patientData.fullName,
          dateOfBirth: patientData.dateOfBirth || patient.dateOfBirth,
          gender: patientData.gender || patient.gender,
          address: patientData.address || patient.address,
          bloodGroup: patientData.bloodGroup || patient.bloodGroup,
          emergencyContact: patientData.emergencyContact || patient.emergencyContact,
        },
      });
    }

    // Calculate queue token number
    const dayAppointmentsCount = await prisma.appointment.count({
      where: {
        doctorId,
        appointmentDate,
        status: { in: ['CONFIRMED', 'WAITING', 'IN_CONSULTATION', 'COMPLETED'] },
      },
    });
    const tokenNumber = dayAppointmentsCount + 1;

    const dateFormatted = appointmentDate.replace(/-/g, '');
    const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase();
    const appointmentNumber = `APT-${dateFormatted}-${randomHex}-OFF`;

    const fee = customFee !== undefined ? customFee : doctor.consultationFee;

    const appointment = await prisma.appointment.create({
      data: {
        appointmentNumber,
        hospitalId,
        doctorId,
        patientId: patient.id,
        departmentId,
        appointmentDate,
        timeSlot: timeSlot || 'Walk-in / Immediate',
        tokenNumber,
        status: 'CONFIRMED',
        bookingType: 'OFFLINE',
        consultationFee: fee,
        platformFee: 0,
        totalAmount: fee,
        notes,
      },
      include: {
        hospital: true,
        doctor: true,
        patient: true,
        department: true,
      },
    });

    // Generate unique OP number & QR code
    const dateParts = appointmentDate.split('-');
    const opNumber = `OP-${dateParts[0]}-${dateParts[1]}${dateParts[2]}-${crypto.randomInt(100000, 999999)}`;
    const secureToken = crypto.randomBytes(24).toString('hex');
    const verificationUrl = `${ENV.CLIENT_URL}/verify-op/${secureToken}`;

    const digitalOp = await prisma.digitalOP.create({
      data: {
        opNumber,
        secureToken,
        appointmentId: appointment.id,
        qrData: verificationUrl,
        isVerified: true, // Already at hospital counter
        verifiedAt: new Date(),
      },
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'OFFLINE_BOOKING_CREATED',
      entity: 'Appointment',
      entityId: appointment.id,
      details: {
        appointmentNumber,
        patientName: patient.fullName,
        doctorName: doctor.name,
        tokenNumber,
      },
    });

    return {
      appointment,
      digitalOp,
    };
  }
}
