import prisma from '../config/prisma';
import { AuditService } from '../utils/audit';

export class DoctorDashboardService {
  static async getDoctorAppointments(doctorId: string, date?: string) {
    const targetDate = date || new Date().toISOString().split('T')[0];

    return prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: targetDate,
        status: { in: ['CONFIRMED', 'WAITING', 'IN_CONSULTATION', 'COMPLETED', 'NO_SHOW', 'CANCELLED'] },
      },
      include: {
        patient: true,
        department: true,
        prescription: true,
        medicalRecord: true,
        digitalOp: true,
      },
      orderBy: { tokenNumber: 'asc' },
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
      vitals?: { bp?: string; pulse?: string; temperature?: string; weight?: string; spo2?: string };
      clinicalNotes?: string;
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

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update appointment status to COMPLETED
      const updatedApt = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: 'COMPLETED',
          notes: data.clinicalNotes || apt.notes,
        },
      });

      // 2. Create Prescription
      const prescription = await tx.prescription.upsert({
        where: { appointmentId },
        update: {
          diagnosis: data.diagnosis,
          medicines: JSON.stringify(data.medicines || []),
          instructions: data.instructions,
          followUpDate: data.followUpDate,
        },
        create: {
          appointmentId,
          doctorId,
          diagnosis: data.diagnosis,
          medicines: JSON.stringify(data.medicines || []),
          instructions: data.instructions,
          followUpDate: data.followUpDate,
        },
      });

      // 3. Create Medical Record
      const medicalRecord = await tx.medicalRecord.upsert({
        where: { appointmentId },
        update: {
          symptoms: data.symptoms,
          vitals: JSON.stringify(data.vitals || {}),
          clinicalNotes: data.clinicalNotes,
        },
        create: {
          appointmentId,
          patientId: apt.patientId,
          symptoms: data.symptoms,
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
      details: { diagnosis: data.diagnosis, medicinesCount: data.medicines?.length || 0 },
    });

    return result;
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
}
