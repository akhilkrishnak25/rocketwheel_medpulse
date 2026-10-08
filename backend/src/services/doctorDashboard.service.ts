import crypto from 'crypto';
import prisma from '../config/prisma';
import { AuditService } from '../utils/audit';
import { NotificationService } from './notification.service';
import { generateClinicalConsultationPdf } from '../utils/pdf';

export class DoctorDashboardService {
  static async getDoctorAppointments(doctorId: string, date?: string) {
    const today = new Date().toISOString().split('T')[0];
    let dateFilter: any = today;
    let orderClause: any = { tokenNumber: 'asc' };

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
    } else {
      dateFilter = date;
      orderClause = { tokenNumber: 'asc' };
    }

    return prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: dateFilter,
        status: { in: ['CONFIRMED', 'WAITING', 'IN_CONSULTATION', 'COMPLETED', 'NO_SHOW', 'CANCELLED'] },
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
    const existing = await prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!existing) throw new Error('Doctor not found');

    const updated = await prisma.doctor.update({
      where: { id: doctorId },
      data: {
        about: data.about !== undefined ? data.about : existing.about,
        languages: data.languages !== undefined ? data.languages : existing.languages,
        workingDays: data.workingDays !== undefined ? data.workingDays : existing.workingDays,
        workingHoursStart: data.workingHoursStart !== undefined ? data.workingHoursStart : existing.workingHoursStart,
        workingHoursEnd: data.workingHoursEnd !== undefined ? data.workingHoursEnd : existing.workingHoursEnd,
        breakStart: data.breakStart !== undefined ? data.breakStart : existing.breakStart,
        breakEnd: data.breakEnd !== undefined ? data.breakEnd : existing.breakEnd,
        photoUrl: data.photoUrl !== undefined ? data.photoUrl : existing.photoUrl,
        consultationFee: data.consultationFee !== undefined ? Number(data.consultationFee) : existing.consultationFee,
      },
      include: { department: true, hospital: true },
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'UPDATE_DOCTOR_OWN_PROFILE',
      entity: 'Doctor',
      entityId: doctorId,
      details: data,
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
          vitals: JSON.stringify(data.vitals || {}),
          clinicalNotes: data.clinicalNotes,
        },
        create: {
          appointmentId,
          patientId: apt.patientId,
          symptoms: chiefComplaintsText,
          vitals: JSON.stringify(data.vitals || {}),
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
        labRequests: { include: { report: true } },
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

    let parsedVitals: any = null;
    if (apt.vitals?.[0]) {
      const v = apt.vitals[0];
      parsedVitals = {
        bp: v.bloodPressure || (v.bpSystolic && v.bpDiastolic ? `${v.bpSystolic}/${v.bpDiastolic}` : null),
        pulse: v.pulseRate,
        temperature: v.temperature,
        spo2: v.spo2,
        weight: v.weight,
        height: v.height,
      };
    } else if (apt.medicalRecord?.vitals) {
      try {
        const v = JSON.parse(apt.medicalRecord.vitals);
        parsedVitals = {
          bp: v.bp,
          pulse: v.pulse,
          temperature: v.temperature,
          spo2: v.spo2,
          weight: v.weight,
          height: v.height,
        };
      } catch {}
    }

    const labTestsList: Array<{ name: string; status: string }> = [];
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
            status: req.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
          });
        }
      }
    }

    const pdfBuffer = await generateClinicalConsultationPdf({
      appointmentNumber: apt.appointmentNumber,
      consultationDate: apt.appointmentDate,
      tokenNumber: apt.tokenNumber,
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
}
