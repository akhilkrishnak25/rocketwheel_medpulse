import crypto from 'crypto';
import ExcelJS from 'exceljs';
import { Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/prisma';
import { AuditService } from '../utils/audit';
import { NotificationService } from './notification.service';
import { generateClinicalConsultationPdf } from '../utils/pdf';
import { formatBP, formatSystolicDiastolicBP, resolveConsultationVitals } from '../utils/vitals';

export class DoctorDashboardService {
  static async getDoctorAppointments(doctorId: string, date?: string) {
    const today = new Date().toISOString().split('T')[0];
    let dateFilter: any = today;
    let orderClause: any = { tokenNumber: 'asc' };
    let statusFilterClause: any = { in: ['CONFIRMED', 'WAITING', 'IN_CONSULTATION', 'COMPLETED', 'NO_SHOW', 'CANCELLED'] };

    if (date?.toUpperCase() === 'COMPLETED') {
      return prisma.appointment.findMany({
        where: {
          doctorId,
          status: 'COMPLETED',
        },
        include: {
          patient: true,
          department: true,
          prescription: {
            include: { pharmacy: true },
          },
          medicalRecord: true,
          digitalOp: true,
          assignedStaff: {
            include: {
              user: { select: { id: true, name: true, email: true, phone: true } },
            },
          },
          vitals: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          labRequests: {
            include: { lab: true, report: true },
          },
        },
        orderBy: [{ appointmentDate: 'desc' }, { tokenNumber: 'asc' }],
      });
    }

    if (!date || date.toUpperCase() === 'TODAY') {
      dateFilter = today;
      orderClause = { tokenNumber: 'asc' };
    } else if (date.toUpperCase() === 'TOMORROW') {
      const tom = new Date();
      tom.setDate(tom.getDate() + 1);
      dateFilter = tom.toISOString().split('T')[0];
      orderClause = { tokenNumber: 'asc' };
    } else if (date.toUpperCase() === 'UPCOMING' || date.toUpperCase() === 'NEXT_DAYS') {
      // All future days from tomorrow onwards
      dateFilter = { gt: today };
      orderClause = [{ appointmentDate: 'asc' }, { tokenNumber: 'asc' }];
    } else if (date.toUpperCase() === 'ALL_FUTURE') {
      dateFilter = { gte: today };
      orderClause = [{ appointmentDate: 'asc' }, { tokenNumber: 'asc' }];
    } else if (date.toUpperCase() === 'ALL') {
      dateFilter = undefined;
      orderClause = [{ appointmentDate: 'desc' }, { tokenNumber: 'asc' }];
    } else {
      dateFilter = date;
      orderClause = { tokenNumber: 'asc' };
    }

    return prisma.appointment.findMany({
      where: {
        doctorId,
        ...(dateFilter ? { appointmentDate: dateFilter } : {}),
        status: statusFilterClause,
      },
      include: {
        patient: true,
        department: true,
        prescription: {
          include: { pharmacy: true },
        },
        medicalRecord: true,
        digitalOp: true,
        assignedStaff: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
          },
        },
        vitals: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        labRequests: {
          include: { lab: true, report: true },
        },
      },
      orderBy: orderClause,
    });
  }

  static async getDoctorProfile(doctorId: string) {
    return prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true, avatarUrl: true, role: true, status: true },
        },
        hospital: {
          select: { id: true, name: true, city: true, phone: true, emergencyContact: true, logoUrl: true },
        },
        department: { select: { id: true, name: true, code: true, icon: true } },
        assignedStaff: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
            department: true,
          },
        },
        schedules: { orderBy: { dayOfWeek: 'asc' } },
        leaves: { orderBy: { startDate: 'desc' } },
      },
    });
  }

  static async updateDoctorProfile(doctorId: string, data: any, requestingUserId?: string) {
    const existing = await prisma.doctor.findUnique({
      where: { id: doctorId },
      include: { user: true },
    });
    if (!existing) throw new Error('Doctor not found');

    if (requestingUserId && existing.userId && existing.userId !== requestingUserId) {
      throw new Error('Unauthorized: You can only edit your own doctor profile');
    }

    if (data.email && existing.user && data.email.toLowerCase().trim() !== existing.user.email.toLowerCase().trim()) {
      const emailInUse = await prisma.user.findUnique({
        where: { email: data.email.toLowerCase().trim() },
      });
      if (emailInUse && emailInUse.id !== existing.userId) {
        throw new Error('Email is already in use by another account');
      }
    }

    let passwordHash: string | undefined;
    if (data.password && typeof data.password === 'string' && data.password.trim().length >= 6) {
      passwordHash = await bcrypt.hash(data.password.trim(), 10);
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (existing.userId) {
        const userUpdateData: any = {};
        if (data.name !== undefined && data.name.trim()) userUpdateData.name = data.name.trim();
        if (data.phone !== undefined) userUpdateData.phone = data.phone ? data.phone.trim() : null;
        if (data.email !== undefined && data.email.trim()) userUpdateData.email = data.email.toLowerCase().trim();
        if (data.photoUrl !== undefined) userUpdateData.avatarUrl = data.photoUrl ? data.photoUrl.trim() : null;
        if (passwordHash) userUpdateData.passwordHash = passwordHash;

        if (Object.keys(userUpdateData).length > 0) {
          await tx.user.update({
            where: { id: existing.userId },
            data: userUpdateData,
          });
        }
      }

      return tx.doctor.update({
        where: { id: doctorId },
        data: {
          name: data.name !== undefined ? data.name.trim() : existing.name,
          photoUrl: data.photoUrl !== undefined ? (data.photoUrl ? data.photoUrl.trim() : null) : existing.photoUrl,
          qualification: data.qualification !== undefined ? data.qualification.trim() : existing.qualification,
          specialization: data.specialization !== undefined ? data.specialization.trim() : existing.specialization,
          experienceYears: data.experienceYears !== undefined ? Number(data.experienceYears) : existing.experienceYears,
          consultationFee: data.consultationFee !== undefined ? Number(data.consultationFee) : existing.consultationFee,
          languages: data.languages !== undefined ? (Array.isArray(data.languages) ? data.languages.join(', ') : String(data.languages)) : existing.languages,
          about: data.about !== undefined ? data.about.trim() : existing.about,
          workingDays: data.workingDays !== undefined ? (Array.isArray(data.workingDays) ? data.workingDays.join(', ') : String(data.workingDays)) : existing.workingDays,
          workingHoursStart: data.workingHoursStart !== undefined ? data.workingHoursStart : existing.workingHoursStart,
          workingHoursEnd: data.workingHoursEnd !== undefined ? data.workingHoursEnd : existing.workingHoursEnd,
          slotDurationMinutes: data.slotDurationMinutes !== undefined ? Number(data.slotDurationMinutes) : existing.slotDurationMinutes,
          breakStart: data.breakStart !== undefined ? data.breakStart : existing.breakStart,
          breakEnd: data.breakEnd !== undefined ? data.breakEnd : existing.breakEnd,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true, avatarUrl: true, role: true, status: true },
          },
          department: true,
          hospital: true,
        },
      });
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'UPDATE_DOCTOR_OWN_PROFILE',
      entity: 'Doctor',
      entityId: doctorId,
      details: {
        name: updated.name,
        email: updated.user?.email,
        qualification: updated.qualification,
        specialization: updated.specialization,
      },
    });

    return updated;
  }

  static async getDoctorSchedules(doctorId: string) {
    return prisma.doctorSchedule.findMany({
      where: { doctorId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  static async updateDoctorSchedules(
    doctorId: string,
    schedules: Array<{ dayOfWeek: number; startTime: string; endTime: string; slotDurationMinutes: number; isAvailable: boolean }>,
    requestingUserId?: string
  ) {
    await prisma.$transaction(async (tx) => {
      for (const s of schedules) {
        await tx.doctorSchedule.upsert({
          where: { doctorId_dayOfWeek: { doctorId, dayOfWeek: s.dayOfWeek } },
          update: {
            startTime: s.startTime,
            endTime: s.endTime,
            slotDurationMinutes: s.slotDurationMinutes,
            isAvailable: s.isAvailable,
          },
          create: {
            doctorId,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            slotDurationMinutes: s.slotDurationMinutes,
            isAvailable: s.isAvailable,
          },
        });
      }
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'UPDATE_DOCTOR_SCHEDULES',
      entity: 'DoctorSchedule',
      entityId: doctorId,
      details: { scheduleCount: schedules.length },
    });

    return prisma.doctorSchedule.findMany({ where: { doctorId }, orderBy: { dayOfWeek: 'asc' } });
  }

  static async getDoctorLeaves(doctorId: string) {
    return prisma.doctorLeave.findMany({
      where: { doctorId },
      orderBy: { startDate: 'desc' },
    });
  }

  static async applyLeave(doctorId: string, data: { startDate: string; endDate: string; reason: string }, requestingUserId?: string) {
    const leave = await prisma.doctorLeave.create({
      data: {
        doctorId,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        reason: data.reason,
      },
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'APPLY_DOCTOR_LEAVE',
      entity: 'DoctorLeave',
      entityId: leave.id,
      details: data,
    });

    return leave;
  }

  static async cancelLeave(doctorId: string, leaveId: string, requestingUserId?: string) {
    const leave = await prisma.doctorLeave.findFirst({ where: { id: leaveId, doctorId } });
    if (!leave) throw new Error('Leave record not found');

    await prisma.doctorLeave.delete({ where: { id: leaveId } });

    await AuditService.log({
      userId: requestingUserId,
      action: 'CANCEL_DOCTOR_LEAVE',
      entity: 'DoctorLeave',
      entityId: leaveId,
    });

    return { success: true, message: 'Leave request cancelled successfully' };
  }

  static async getDoctorStats(doctorId: string) {
    const today = new Date().toISOString().split('T')[0];

    const [
      todayTotal,
      todayCompleted,
      todayWaiting,
      totalCompletedAllTime,
      totalReviews,
      reviews,
    ] = await Promise.all([
      prisma.appointment.count({ where: { doctorId, appointmentDate: today } }),
      prisma.appointment.count({ where: { doctorId, appointmentDate: today, status: 'COMPLETED' } }),
      prisma.appointment.count({ where: { doctorId, appointmentDate: today, status: { in: ['CONFIRMED', 'WAITING', 'IN_CONSULTATION'] } } }),
      prisma.appointment.count({ where: { doctorId, status: 'COMPLETED' } }),
      prisma.review.count({ where: { doctorId } }),
      prisma.review.findMany({ where: { doctorId }, select: { rating: true } }),
    ]);

    const averageRating =
      reviews.length > 0 ? Number((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)) : 4.9;

    return {
      todayQueue: {
        total: todayTotal,
        completed: todayCompleted,
        pendingOrWaiting: todayWaiting,
      },
      allTimePatientsCompleted: totalCompletedAllTime,
      rating: {
        average: averageRating,
        totalReviews,
      },
    };
  }

  static async startConsultation(doctorId: string, appointmentId: string, requestingUserId?: string) {
    const apt = await prisma.appointment.findFirst({
      where: { id: appointmentId, doctorId },
      include: { patient: true },
    });

    if (!apt) {
      throw new Error('Appointment not assigned to this doctor');
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'IN_CONSULTATION' },
      include: { patient: true, department: true },
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'START_CONSULTATION',
      entity: 'Appointment',
      entityId: appointmentId,
      details: { patientName: apt.patient.fullName, tokenNumber: apt.tokenNumber },
    });

    await NotificationService.createNotification({
      hospitalId: updated.hospitalId,
      recipientType: 'HOSPITAL_ADMIN',
      title: 'Consultation In Progress',
      message: `Consultation started for patient ${apt.patient.fullName} (Token #${apt.tokenNumber}).`,
      type: 'CONSULTATION_UPDATE',
      metadata: { appointmentId, status: 'IN_CONSULTATION' },
    });

    return updated;
  }

  static async completeConsultation(
    doctorId: string,
    appointmentId: string,
    data: {
      diagnosis: string;
      medicines: Array<{ name: string; dosage: string; frequency: string; duration: string; instructions?: string }>;
      instructions?: string;
      followUpDate?: string | null;
      symptoms?: string;
      chiefComplaints?: string;
      examination?: string | null;
      vitals?: { bp?: string; pulse?: string; temperature?: string; weight?: string; spo2?: string };
      clinicalNotes?: string;
      sendToPharmacy?: boolean;
      pharmacyId?: string | null;
    },
    requestingUserId?: string
  ) {
    const apt = await prisma.appointment.findFirst({
      where: { id: appointmentId, doctorId },
      include: { patient: true, doctor: true },
    });

    if (!apt) {
      throw new Error('Appointment not assigned to this doctor');
    }

    const chiefComplaintsText = data.chiefComplaints || data.symptoms || null;
    const examinationText = data.examination?.trim() || null;
    const normalizedVitals = data.vitals
      ? {
          ...data.vitals,
          bp: formatBP(data.vitals.bp) || data.vitals.bp,
        }
      : {};

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update appointment status to COMPLETED
      const updatedApt = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: 'COMPLETED',
          notes: data.clinicalNotes || apt.notes,
        },
      });

      // Determine pharmacy assignment
      let targetPharmacyId = data.pharmacyId;
      if (data.sendToPharmacy && !targetPharmacyId) {
        const defaultPharmacy = await tx.pharmacy.findFirst({
          where: { hospitalId: apt.hospitalId, status: 'ACTIVE' },
        });
        targetPharmacyId = defaultPharmacy ? defaultPharmacy.id : null;
      }

      // 2. Create / Update Prescription
      const prescription = await tx.prescription.upsert({
        where: { appointmentId },
        update: {
          diagnosis: data.diagnosis,
          examination: examinationText,
          medicines: JSON.stringify(data.medicines || []),
          instructions: data.instructions,
          followUpDate: data.followUpDate,
          patientId: apt.patientId,
          hospitalId: apt.hospitalId,
          pharmacyId: targetPharmacyId,
          pharmacyStatus: data.sendToPharmacy ? 'SENT' : 'NONE',
          sentToPharmacyAt: data.sendToPharmacy ? new Date() : null,
        },
        create: {
          appointmentId,
          doctorId,
          patientId: apt.patientId,
          hospitalId: apt.hospitalId,
          diagnosis: data.diagnosis,
          examination: examinationText,
          medicines: JSON.stringify(data.medicines || []),
          instructions: data.instructions,
          followUpDate: data.followUpDate,
          pharmacyId: targetPharmacyId,
          pharmacyStatus: data.sendToPharmacy ? 'SENT' : 'NONE',
          sentToPharmacyAt: data.sendToPharmacy ? new Date() : null,
        },
      });

      // 3. Create Medical Record
      const medicalRecord = await tx.medicalRecord.upsert({
        where: { appointmentId },
        update: {
          symptoms: chiefComplaintsText,
          examination: examinationText,
          vitals: JSON.stringify(normalizedVitals),
          clinicalNotes: data.clinicalNotes,
        },
        create: {
          appointmentId,
          patientId: apt.patientId,
          symptoms: chiefComplaintsText,
          examination: examinationText,
          vitals: JSON.stringify(normalizedVitals),
          clinicalNotes: data.clinicalNotes,
        },
      });

      return { appointment: updatedApt, prescription, medicalRecord };
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'COMPLETE_CONSULTATION',
      entity: 'Appointment',
      entityId: appointmentId,
      details: {
        diagnosis: data.diagnosis,
        medicineCount: data.medicines?.length || 0,
        sentToPharmacy: data.sendToPharmacy,
      },
    });

    await NotificationService.createNotification({
      hospitalId: apt.hospitalId,
      recipientType: 'HOSPITAL_ADMIN',
      title: 'Consultation Completed',
      message: `Consultation completed for patient ${apt.patient.fullName}. Diagnosis: ${data.diagnosis}`,
      type: 'CONSULTATION_UPDATE',
      metadata: { appointmentId, status: 'COMPLETED' },
    });

    return result;
  }

  static async getConsultationDetails(doctorId: string, appointmentId: string) {
    const apt = await prisma.appointment.findFirst({
      where: { id: appointmentId, doctorId },
      include: {
        patient: {
          include: {
            vitals: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
            appointments: {
              where: {
                id: { not: appointmentId },
                status: 'COMPLETED',
              },
              include: {
                doctor: { select: { id: true, name: true, specialization: true } },
                prescription: true,
                medicalRecord: true,
              },
              orderBy: { appointmentDate: 'desc' },
              take: 5,
            },
            prescriptions: {
              include: { doctor: { select: { id: true, name: true } } },
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
            labRequests: {
              include: { doctor: { select: { name: true } }, lab: { select: { name: true } }, report: true },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        department: true,
        vitals: {
          orderBy: { createdAt: 'desc' },
        },
        prescription: true,
        medicalRecord: true,
        labRequests: {
          include: { report: true, lab: true },
        },
      },
    });

    if (!apt) throw new Error('Appointment not found');

    const templates = await prisma.prescriptionTemplate.findMany({
      where: { doctorId },
      orderBy: { diseaseName: 'asc' },
    });

    const latestVital = apt.vitals[0] || null;

    return {
      appointment: apt,
      patient: apt.patient,
      vitals: latestVital,
      currentVitals: latestVital,
      chiefComplaints: apt.medicalRecord?.symptoms || null,
      examination: apt.medicalRecord?.examination || apt.prescription?.examination || null,
      patientHistory: {
        previousAppointments: apt.patient.appointments,
        previousPrescriptions: apt.patient.prescriptions,
        previousLabRequests: apt.patient.labRequests,
      },
      templates: templates.map((t) => ({
        ...t,
        medicinesList: JSON.parse(t.medicines || '[]'),
      })),
    };
  }

  // -------------------------------------------------------------
  // DISEASE-BASED PRESCRIPTION TEMPLATES
  // -------------------------------------------------------------
  static async getPrescriptionTemplates(doctorId: string, search?: string) {
    const where: any = { doctorId };
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { diseaseName: { contains: q } },
        { diagnosis: { contains: q } },
      ];
    }
    const templates = await prisma.prescriptionTemplate.findMany({
      where,
      orderBy: { diseaseName: 'asc' },
    });

    return templates.map((t) => ({
      ...t,
      medicinesList: JSON.parse(t.medicines || '[]'),
    }));
  }

  static async bulkCreatePrescriptionTemplates(
    doctorId: string,
    templates: Array<{
      diseaseName: string;
      diagnosis?: string;
      medicines: any[] | string;
      instructions?: string;
    }>,
    requestingUserId?: string
  ) {
    if (!Array.isArray(templates) || templates.length === 0) {
      throw new Error('Please provide at least one valid prescription template.');
    }

    const created = [];
    for (const item of templates) {
      if (!item.diseaseName || !item.diseaseName.trim()) continue;

      let meds: any[] = [];
      if (Array.isArray(item.medicines)) {
        meds = item.medicines;
      } else if (typeof item.medicines === 'string' && item.medicines.trim()) {
        try {
          meds = JSON.parse(item.medicines);
        } catch {
          meds = item.medicines.split(/[,;\n]/).map((m: string) => ({
            name: m.trim(),
            dosage: '1 Tab',
            frequency: '1-0-1',
            duration: '5 days',
            timing: 'AFTER_FOOD',
          })).filter((m: any) => m.name);
        }
      }

      const tmpl = await prisma.prescriptionTemplate.create({
        data: {
          doctorId,
          diseaseName: item.diseaseName.trim(),
          diagnosis: item.diagnosis?.trim() || item.diseaseName.trim(),
          medicines: JSON.stringify(meds),
          instructions: item.instructions?.trim() || null,
        },
      });
      created.push(tmpl);
    }

    await AuditService.log({
      userId: requestingUserId,
      action: 'BULK_CREATE_PRESCRIPTION_TEMPLATES',
      entity: 'PrescriptionTemplate',
      details: { count: created.length },
    });

    return { count: created.length, templates: created };
  }

  static async createPrescriptionTemplate(
    doctorId: string,
    data: { diseaseName: string; diagnosis?: string | null; medicines: any[]; instructions?: string | null },
    requestingUserId?: string
  ) {
    const template = await prisma.prescriptionTemplate.create({
      data: {
        doctorId,
        diseaseName: data.diseaseName,
        diagnosis: data.diagnosis,
        medicines: JSON.stringify(data.medicines || []),
        instructions: data.instructions,
      },
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'CREATE_PRESCRIPTION_TEMPLATE',
      entity: 'PrescriptionTemplate',
      entityId: template.id,
      details: { diseaseName: data.diseaseName },
    });

    return {
      ...template,
      medicinesList: data.medicines,
    };
  }

  static async updatePrescriptionTemplate(
    doctorId: string,
    templateId: string,
    data: { diseaseName?: string; diagnosis?: string | null; medicines?: any[]; instructions?: string | null },
    requestingUserId?: string
  ) {
    const existing = await prisma.prescriptionTemplate.findFirst({
      where: { id: templateId, doctorId },
    });
    if (!existing) throw new Error('Template not found');

    const updated = await prisma.prescriptionTemplate.update({
      where: { id: templateId },
      data: {
        diseaseName: data.diseaseName !== undefined ? data.diseaseName : existing.diseaseName,
        diagnosis: data.diagnosis !== undefined ? data.diagnosis : existing.diagnosis,
        medicines: data.medicines !== undefined ? JSON.stringify(data.medicines) : existing.medicines,
        instructions: data.instructions !== undefined ? data.instructions : existing.instructions,
      },
    });

    return {
      ...updated,
      medicinesList: data.medicines || JSON.parse(updated.medicines || '[]'),
    };
  }

  static async deletePrescriptionTemplate(doctorId: string, templateId: string, requestingUserId?: string) {
    const existing = await prisma.prescriptionTemplate.findFirst({
      where: { id: templateId, doctorId },
    });
    if (!existing) throw new Error('Template not found');

    await prisma.prescriptionTemplate.delete({ where: { id: templateId } });
    return { success: true };
  }

  // -------------------------------------------------------------
  // LAB TEST REQUESTS
  // -------------------------------------------------------------
  static async createLabTestRequest(
    doctorId: string,
    data: {
      appointmentId?: string | null;
      patientId: string;
      labId?: string | null;
      tests: Array<{ name: string; code?: string | null; price?: number | null; notes?: string | null }>;
      clinicalNotes?: string | null;
      priority?: 'NORMAL' | 'URGENT';
    },
    requestingUserId?: string
  ) {
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      include: { hospital: true },
    });
    if (!doctor) throw new Error('Doctor not found');

    // Auto-select lab if not provided
    let targetLabId = data.labId;
    if (targetLabId) {
      const selectedLab = await prisma.lab.findFirst({
        where: { id: targetLabId, status: { in: ['ACTIVE', 'APPROVED'] } },
      });
      if (!selectedLab) {
        throw new Error('Selected laboratory is currently inactive or not approved.');
      }
    } else {
      const hospitalLab = await prisma.lab.findFirst({
        where: { hospitalId: doctor.hospitalId, status: { in: ['ACTIVE', 'APPROVED'] } },
      });
      if (hospitalLab) {
        targetLabId = hospitalLab.id;
      } else {
        const anyApprovedLab = await prisma.lab.findFirst({
          where: { status: { in: ['ACTIVE', 'APPROVED'] } },
        });
        if (!anyApprovedLab) {
          throw new Error('No accredited diagnostic laboratory is currently active. Please contact administrator.');
        }
        targetLabId = anyApprovedLab.id;
      }
    }

    const totalAmount = data.tests.reduce((acc, t: any) => acc + (Number(t.price) || 0), 0);
    const dateFormatted = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randCode = crypto.randomBytes(2).toString('hex').toUpperCase();
    const requestNumber = `LAB-${dateFormatted}-${randCode}`;

    const request = await prisma.labTestRequest.create({
      data: {
        requestNumber,
        hospitalId: doctor.hospitalId,
        doctorId,
        patientId: data.patientId,
        appointmentId: data.appointmentId,
        labId: targetLabId,
        tests: JSON.stringify(data.tests),
        clinicalNotes: data.clinicalNotes,
        priority: data.priority || 'NORMAL',
        status: 'REQUESTED',
        totalAmount,
      },
      include: {
        patient: true,
        doctor: { select: { id: true, name: true } },
        lab: true,
      },
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'CREATE_LAB_REQUEST',
      entity: 'LabTestRequest',
      entityId: request.id,
      details: { requestNumber, testsCount: data.tests.length, totalAmount },
    });

    if (doctor.hospitalId) {
      await NotificationService.createNotification({
        hospitalId: doctor.hospitalId,
        recipientType: 'LAB_TECH',
        recipientId: targetLabId,
        title: 'New Lab Request Received',
        message: `New lab requisition #${requestNumber} created for patient ${request.patient.fullName} (${data.tests.length} tests).`,
        type: 'LAB_REQUEST_RECEIVED',
        metadata: { requestId: request.id, requestNumber, labId: targetLabId },
      });
    }

    return request;
  }

  static async getDoctorLabRequests(doctorId: string) {
    return prisma.labTestRequest.findMany({
      where: { doctorId },
      include: {
        patient: { select: { id: true, fullName: true, mobileNumber: true, patientIdNumber: true } },
        lab: { select: { id: true, name: true, phone: true } },
        report: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getPrescription(doctorId: string, appointmentId: string) {
    const apt = await prisma.appointment.findFirst({
      where: { id: appointmentId, doctorId },
      include: {
        patient: true,
        doctor: { include: { hospital: true, department: true } },
        prescription: true,
        medicalRecord: true,
      },
    });

    if (!apt || !apt.prescription) {
      throw new Error('Prescription not found for this appointment');
    }

    return {
      appointment: apt,
      prescription: {
        ...apt.prescription,
        medicines: JSON.parse(apt.prescription.medicines || '[]'),
      },
      medicalRecord: apt.medicalRecord
        ? {
            ...apt.medicalRecord,
            vitals: JSON.parse(apt.medicalRecord.vitals || '{}'),
          }
        : null,
    };
  }

  static async generateConsultationPdf(doctorId: string, appointmentId: string) {
    const apt = await prisma.appointment.findFirst({
      where: { id: appointmentId, doctorId },
      include: {
        hospital: true,
        doctor: { include: { department: true } },
        patient: true,
        prescription: true,
        medicalRecord: true,
        vitals: { orderBy: { createdAt: 'desc' }, take: 1 },
        labRequests: { include: { report: true, lab: true } },
      },
    });

    if (!apt) throw new Error('Consultation appointment not found');

    let parsedMedicines: any[] = [];
    if (apt.prescription?.medicines) {
      try {
        parsedMedicines = JSON.parse(apt.prescription.medicines);
      } catch {
        parsedMedicines = [];
      }
    }

    const parsedVitals = resolveConsultationVitals(apt);

    const labTestsList: Array<{ name: string; status: string; category?: string }> = [];
    if (apt.labRequests && apt.labRequests.length > 0) {
      for (const req of apt.labRequests) {
        let tList: any[] = [];
        try {
          tList = JSON.parse(req.tests || '[]');
        } catch {
          tList = [{ name: req.tests }];
        }
        for (const t of tList) {
          labTestsList.push({
            name: t.name || 'Diagnostic Test',
            status: req.status || 'PENDING',
            category: t.category || req.lab?.name || undefined,
          });
        }
      }
    }

    const pdfBuffer = await generateClinicalConsultationPdf({
      appointmentNumber: apt.appointmentNumber,
      consultationDate: apt.appointmentDate,
      tokenNumber: apt.tokenNumber,
      letterheadHeight: (apt.hospital as any)?.letterheadHeight || 144,
      hospital: {
        name: apt.hospital.name,
        address: apt.hospital.address,
        city: apt.hospital.city,
        phone: apt.hospital.phone,
        email: apt.hospital.email || undefined,
      },
      doctor: {
        name: apt.doctor.name,
        qualification: apt.doctor.qualification,
        specialization: apt.doctor.specialization,
        department: apt.doctor.department?.name,
      },
      patient: {
        fullName: apt.patient.fullName,
        patientIdNumber: apt.patient.patientIdNumber,
        mobileNumber: apt.patient.mobileNumber,
        age: apt.patient.age,
        gender: apt.patient.gender,
        bloodGroup: apt.patient.bloodGroup,
      },
      chiefComplaints: apt.medicalRecord?.symptoms || null,
      examination: apt.medicalRecord?.examination || apt.prescription?.examination || null,
      vitals: parsedVitals,
      diagnosis: apt.prescription?.diagnosis || 'Clinical evaluation completed',
      medicines: parsedMedicines,
      labRequests: labTestsList,
      clinicalNotes: apt.medicalRecord?.clinicalNotes || apt.notes || null,
      instructions: apt.prescription?.instructions || null,
      followUpDate: apt.prescription?.followUpDate || null,
    });

    return pdfBuffer;
  }

  static async getHospitalSupportStaff(doctorId: string) {
    const doc = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { hospitalId: true },
    });
    if (!doc) throw new Error('Doctor profile not found');

    return prisma.supportStaff.findMany({
      where: {
        hospitalId: doc.hospitalId,
        status: { in: ['ACTIVE', 'APPROVED'] },
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async updateAssignedSupportStaff(doctorId: string, assignedStaffId: string | null, requestingUserId?: string) {
    const doc = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { id: true, hospitalId: true, name: true },
    });
    if (!doc) throw new Error('Doctor profile not found');

    if (assignedStaffId) {
      const staff = await prisma.supportStaff.findFirst({
        where: { id: assignedStaffId, hospitalId: doc.hospitalId },
        include: { user: true },
      });
      if (!staff) {
        throw new Error('Selected support staff is not registered or approved in your hospital');
      }
    }

    const updated = await prisma.doctor.update({
      where: { id: doctorId },
      data: { assignedStaffId },
      include: {
        assignedStaff: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
            department: true,
          },
        },
      },
    });

    // Also sync existing active / upcoming appointments for this doctor to this assigned staff
    const today = new Date().toISOString().split('T')[0];
    await prisma.appointment.updateMany({
      where: {
        doctorId,
        appointmentDate: { gte: today },
        status: { in: ['CONFIRMED', 'WAITING', 'PENDING_PAYMENT'] },
      },
      data: { assignedStaffId },
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'UPDATE_DOCTOR_ASSIGNED_STAFF',
      entity: 'Doctor',
      entityId: doctorId,
      details: { assignedStaffId, doctorName: doc.name },
    });

    return updated;
  }

  // -------------------------------------------------------------
  // EXPORT ALL DOCTOR DATA TO EXCEL WORKBOOK (.xlsx)
  // -------------------------------------------------------------
  static async exportAllDoctorDataToExcel(doctorId: string, res: Response, filterStatus?: string) {
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        hospital: { select: { id: true, name: true, code: true, city: true, state: true } },
        department: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true, phone: true } },
        assignedStaff: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
          },
        },
      },
    });

    if (!doctor) {
      throw new Error('Doctor record not found');
    }

    const today = new Date().toISOString().split('T')[0];

    const aptWhere: any = { doctorId };
    if (filterStatus && filterStatus !== 'ALL') {
      aptWhere.status = filterStatus;
    }

    // Fetch all related doctor records
    const [
      appointments,
      templates,
      labRequests,
      schedules,
      leaves,
    ] = await Promise.all([
      prisma.appointment.findMany({
        where: aptWhere,
        include: {
          patient: true,
          department: true,
          vitals: { orderBy: { createdAt: 'desc' }, take: 1 },
          prescription: true,
          assignedStaff: { include: { user: { select: { name: true, phone: true } } } },
          payment: { select: { status: true, paymentMethod: true } },
        },
        orderBy: [{ appointmentDate: 'desc' }, { tokenNumber: 'asc' }],
      }),
      prisma.prescriptionTemplate.findMany({
        where: { doctorId },
        orderBy: { diseaseName: 'asc' },
      }),
      prisma.labTestRequest.findMany({
        where: { doctorId },
        include: {
          patient: true,
          report: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.doctorSchedule.findMany({
        where: { doctorId },
        orderBy: { dayOfWeek: 'asc' },
      }),
      prisma.doctorLeave.findMany({
        where: { doctorId },
        orderBy: { startDate: 'desc' },
      }),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RocketWheel MedPulse Platform';
    workbook.created = new Date();

    const applyHeaderStyle = (row: ExcelJS.Row, bgArgb = 'FF0F766E') => {
      row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgArgb },
      };
      row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      row.height = 26;
    };

    // -------------------------------------------------------------
    // SHEET 1: DOCTOR SUMMARY & METRICS
    // -------------------------------------------------------------
    const summarySheet = workbook.addWorksheet('Overview & Summary');
    summarySheet.columns = [
      { header: 'Profile Field / Metric', key: 'metric', width: 35 },
      { header: 'Details / Current Value', key: 'value', width: 45 },
    ];
    applyHeaderStyle(summarySheet.getRow(1), 'FF1E40AF');

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const summaryRows = [
      { metric: 'Doctor Full Name', value: doctor.user?.name || doctor.name },
      { metric: 'Clinical Specialization', value: doctor.specialization },
      { metric: 'Medical Qualifications', value: doctor.qualification },
      { metric: 'Hospital Facility', value: doctor.hospital?.name || 'N/A' },
      { metric: 'Department', value: doctor.department?.name || 'N/A' },
      { metric: 'Consultation Fee (INR)', value: `₹${doctor.consultationFee}` },
      { metric: 'Experience', value: `${doctor.experienceYears} Years` },
      { metric: 'Working Hours', value: `${doctor.workingHoursStart} - ${doctor.workingHoursEnd} (${doctor.slotDurationMinutes}m slots)` },
      { metric: 'Designated Support Staff (Nurse)', value: doctor.assignedStaff?.user?.name || 'Hospital General Pool' },
      { metric: 'Doctor Contact Email', value: doctor.user?.email || 'N/A' },
      { metric: 'Doctor Contact Phone', value: doctor.user?.phone ? `+91 ${doctor.user.phone}` : 'N/A' },
      { metric: '--- DATA TOTALS ---', value: '------------------------' },
      { metric: 'Total Patient Records on File', value: appointments.length },
      { metric: 'Today\'s Patient Queue', value: appointments.filter((a) => a.appointmentDate === today).length },
      { metric: 'Completed Consultations', value: appointments.filter((a) => a.status === 'COMPLETED').length },
      { metric: 'In Consultation / Waiting', value: appointments.filter((a) => ['WAITING', 'IN_CONSULTATION', 'CONFIRMED'].includes(a.status)).length },
      { metric: 'Cancelled Appointments', value: appointments.filter((a) => a.status === 'CANCELLED').length },
      { metric: 'Disease Prescription Templates', value: templates.length },
      { metric: 'Diagnostic Lab Requisitions', value: labRequests.length },
      { metric: 'Active Duty Schedules', value: schedules.filter((s) => s.isAvailable).length },
      { metric: 'Doctor Duty Leaves on Record', value: leaves.length },
      { metric: 'Report Export Generated At', value: new Date().toLocaleString() },
    ];

    summaryRows.forEach((r) => summarySheet.addRow(r));

    // -------------------------------------------------------------
    // SHEET 2: ALL PATIENT QUEUE & APPOINTMENTS
    // -------------------------------------------------------------
    const queueSheet = workbook.addWorksheet(filterStatus === 'COMPLETED' ? 'Completed Consultations' : 'Patient Queue & Consultations');
    queueSheet.columns = [
      { header: 'Token #', key: 'tokenNumber', width: 10 },
      { header: 'Booking ID', key: 'appointmentNumber', width: 20 },
      { header: 'Date', key: 'appointmentDate', width: 14 },
      { header: 'Time Slot', key: 'timeSlot', width: 16 },
      { header: 'Patient UHID / ID', key: 'patientId', width: 18 },
      { header: 'Patient Name', key: 'patientName', width: 22 },
      { header: 'Age / Gender', key: 'demographics', width: 16 },
      { header: 'Mobile Number', key: 'mobile', width: 16 },
      { header: 'Queue Status', key: 'status', width: 16 },
      { header: 'Booking Type', key: 'bookingType', width: 14 },
      { header: 'Follow-up Date', key: 'followUpDate', width: 16 },
      { header: 'Assigned Nurse', key: 'nurse', width: 20 },
      { header: 'BP (mmHg)', key: 'bp', width: 14 },
      { header: 'Pulse (bpm)', key: 'pulse', width: 12 },
      { header: 'Temp (°F)', key: 'temp', width: 12 },
      { header: 'SpO2 (%)', key: 'spo2', width: 12 },
      { header: 'Weight (kg)', key: 'weight', width: 12 },
      { header: 'Height (cm)', key: 'height', width: 12 },
      { header: 'BMI', key: 'bmi', width: 10 },
      { header: 'Fee (₹)', key: 'fee', width: 12 },
      { header: 'Payment Status', key: 'paymentStatus', width: 16 },
      { header: 'Clinical Diagnosis', key: 'diagnosis', width: 28 },
      { header: 'Doctor Notes', key: 'notes', width: 28 },
    ];
    applyHeaderStyle(queueSheet.getRow(1), 'FF0D9488'); // Teal header

    for (const apt of appointments) {
      const v = apt.vitals?.[0];
      const bmi = v?.weight && v?.height ? (v.weight / Math.pow(v.height / 100, 2)).toFixed(1) : 'N/A';
      queueSheet.addRow({
        tokenNumber: apt.tokenNumber,
        appointmentNumber: apt.appointmentNumber,
        appointmentDate: apt.appointmentDate,
        timeSlot: apt.timeSlot,
        patientId: apt.patient?.patientIdNumber || apt.patient?.id?.substring(0, 8) || 'N/A',
        patientName: apt.patient?.fullName || 'N/A',
        demographics: `${apt.patient?.gender || 'Unknown'}, ${apt.patient?.dateOfBirth ? Math.floor((Date.now() - new Date(apt.patient.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000)) + 'y' : 'N/A'}`,
        mobile: apt.patient?.mobileNumber || 'N/A',
        status: apt.status,
        bookingType: apt.bookingType,
        followUpDate: apt.prescription?.followUpDate || 'N/A',
        nurse: apt.assignedStaff?.user?.name || doctor.assignedStaff?.user?.name || 'General Nursing Pool',
        bp: formatBP(v?.bloodPressure) || formatSystolicDiastolicBP(v?.bpSystolic, v?.bpDiastolic) || 'N/A',
        pulse: v?.pulseRate ? `${v.pulseRate} bpm` : 'N/A',
        temp: v?.temperature ? `${v.temperature}°F` : 'N/A',
        spo2: v?.spo2 ? `${v.spo2}%` : 'N/A',
        weight: v?.weight ? `${v.weight} kg` : 'N/A',
        height: v?.height ? `${v.height} cm` : 'N/A',
        bmi,
        fee: apt.consultationFee ?? apt.totalAmount ?? 0,
        paymentStatus: apt.payment?.status || (apt.bookingType === 'OFFLINE' ? 'PAID_COUNTER' : 'PENDING'),
        diagnosis: apt.prescription?.diagnosis || 'N/A',
        notes: apt.prescription?.instructions || apt.notes || '',
      });
    }

    // -------------------------------------------------------------
    // SHEET 3: PRESCRIPTION DISEASE TEMPLATES
    // -------------------------------------------------------------
    const tmplSheet = workbook.addWorksheet('Prescription Templates');
    tmplSheet.columns = [
      { header: 'Template Disease Name', key: 'diseaseName', width: 28 },
      { header: 'Medicines Count', key: 'medCount', width: 16 },
      { header: 'Prescribed Medicines', key: 'medicinesList', width: 45 },
      { header: 'Clinical Instructions', key: 'instructions', width: 35 },
      { header: 'Diagnosis Note', key: 'diagnosis', width: 25 },
      { header: 'Created Date', key: 'createdAt', width: 16 },
    ];
    applyHeaderStyle(tmplSheet.getRow(1), 'FF7C3AED'); // Purple header

    for (const tmpl of templates) {
      let meds: any[] = [];
      try {
        meds = typeof tmpl.medicines === 'string' ? JSON.parse(tmpl.medicines) : (tmpl.medicines || []);
      } catch {
        meds = [];
      }
      const medsFormatted = meds.map((m: any) => `${m.name || 'Medicine'} ${m.dosage || ''} (${m.frequency || ''}, ${m.duration || ''})`).join('; ');
      tmplSheet.addRow({
        diseaseName: tmpl.diseaseName,
        medCount: meds.length,
        medicinesList: medsFormatted || 'None',
        instructions: tmpl.instructions || 'N/A',
        diagnosis: tmpl.diagnosis || 'N/A',
        createdAt: new Date(tmpl.createdAt).toLocaleDateString(),
      });
    }

    // -------------------------------------------------------------
    // SHEET 4: LAB INVESTIGATION REQUISITIONS
    // -------------------------------------------------------------
    const labSheet = workbook.addWorksheet('Lab Requisitions');
    labSheet.columns = [
      { header: 'Requisition #', key: 'requestNumber', width: 18 },
      { header: 'Patient Name', key: 'patientName', width: 22 },
      { header: 'Patient Mobile', key: 'patientMobile', width: 16 },
      { header: 'Tests Ordered', key: 'tests', width: 35 },
      { header: 'Priority', key: 'priority', width: 14 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Clinical Indication', key: 'notes', width: 30 },
      { header: 'Requested Date', key: 'requestedDate', width: 16 },
      { header: 'Report File', key: 'report', width: 20 },
    ];
    applyHeaderStyle(labSheet.getRow(1), 'FF2563EB'); // Royal Blue header

    for (const lr of labRequests) {
      let testsText = '';
      try {
        const parsed = typeof (lr as any).testsRequested === 'string' ? JSON.parse((lr as any).testsRequested) : (lr as any).testsRequested;
        testsText = Array.isArray(parsed) ? parsed.map((t: any) => t.name || t).join(', ') : (lr as any).testsRequested || 'Diagnostic Investigation';
      } catch {
        testsText = (lr as any).testsRequested || 'Diagnostic Investigation';
      }

      labSheet.addRow({
        requestNumber: lr.requestNumber,
        patientName: lr.patient?.fullName || 'N/A',
        patientMobile: lr.patient?.mobileNumber || 'N/A',
        tests: testsText,
        priority: (lr as any).priority || 'ROUTINE',
        status: (lr as any).status || 'REQUESTED',
        notes: (lr as any).clinicalNotes || 'N/A',
        requestedDate: new Date(lr.createdAt).toLocaleDateString(),
        report: lr.report ? 'Published' : 'Pending',
      });
    }

    // -------------------------------------------------------------
    // SHEET 5: PRACTICE SCHEDULES & ROSTER
    // -------------------------------------------------------------
    const schedSheet = workbook.addWorksheet('Weekly Practice Schedules');
    schedSheet.columns = [
      { header: 'Day of Week', key: 'day', width: 18 },
      { header: 'Start Time', key: 'startTime', width: 16 },
      { header: 'End Time', key: 'endTime', width: 16 },
      { header: 'Slot Duration (Min)', key: 'duration', width: 20 },
      { header: 'Available Status', key: 'status', width: 18 },
    ];
    applyHeaderStyle(schedSheet.getRow(1), 'FFD97706'); // Amber header

    for (const sc of schedules) {
      schedSheet.addRow({
        day: dayNames[sc.dayOfWeek] || `Day ${sc.dayOfWeek}`,
        startTime: sc.startTime,
        endTime: sc.endTime,
        duration: `${sc.slotDurationMinutes} Minutes`,
        status: sc.isAvailable ? 'Active Schedule' : 'Duty Off',
      });
    }

    // -------------------------------------------------------------
    // SHEET 6: DOCTOR LEAVE RECORDS
    // -------------------------------------------------------------
    const leaveSheet = workbook.addWorksheet('Leave Records');
    leaveSheet.columns = [
      { header: 'Leave ID', key: 'leaveId', width: 18 },
      { header: 'Start Date', key: 'startDate', width: 16 },
      { header: 'End Date', key: 'endDate', width: 16 },
      { header: 'Reason', key: 'reason', width: 35 },
      { header: 'Leave Status', key: 'status', width: 16 },
      { header: 'Created Date', key: 'createdAt', width: 16 },
    ];
    applyHeaderStyle(leaveSheet.getRow(1), 'FFE11D48'); // Rose header

    for (const lv of leaves) {
      leaveSheet.addRow({
        leaveId: lv.id.substring(0, 8),
        startDate: new Date(lv.startDate).toLocaleDateString(),
        endDate: new Date(lv.endDate).toLocaleDateString(),
        reason: (lv as any).reason || 'Personal Leave',
        status: (lv as any).status || 'APPROVED',
        createdAt: new Date(lv.createdAt).toLocaleDateString(),
      });
    }

    // Set Response Headers and Stream Workbook
    const safeDoctorName = (doctor.name || 'Doctor').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `MedPulse_Doctor_${safeDoctorName}_AllData_${today}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  }
}
