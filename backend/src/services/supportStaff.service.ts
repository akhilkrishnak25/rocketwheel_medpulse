import prisma from '../config/prisma';
import { AuditService } from '../utils/audit';

export class SupportStaffService {
  static async getTodayQueue(hospitalId: string, date?: string) {
    const targetDate = date || new Date().toISOString().split('T')[0];

    return prisma.appointment.findMany({
      where: {
        hospitalId,
        appointmentDate: targetDate,
        status: { in: ['CONFIRMED', 'WAITING', 'IN_CONSULTATION'] },
      },
      include: {
        patient: true,
        doctor: { select: { id: true, name: true, specialization: true } },
        department: { select: { id: true, name: true } },
        vitals: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { tokenNumber: 'asc' },
    });
  }

  static async recordVitals(
    hospitalId: string,
    data: {
      appointmentId: string;
      patientId: string;
      bpSystolic?: number | null;
      bpDiastolic?: number | null;
      bloodPressure?: string | null;
      pulseRate?: number | null;
      temperature?: number | null;
      spo2?: number | null;
      weight?: number | null;
      height?: number | null;
      notes?: string | null;
    },
    staffUserId: string,
    staffName: string
  ) {
    // Validate appointment belongs to this hospital
    const apt = await prisma.appointment.findFirst({
      where: { id: data.appointmentId, hospitalId },
      include: { patient: true },
    });

    if (!apt) {
      throw new Error('Appointment not found for this hospital');
    }

    const bp =
      data.bloodPressure ||
      (data.bpSystolic && data.bpDiastolic ? `${data.bpSystolic}/${data.bpDiastolic}` : null);

    return prisma.$transaction(async (tx) => {
      // 1. Create PatientVital record
      const vital = await tx.patientVital.create({
        data: {
          hospitalId,
          patientId: data.patientId,
          appointmentId: data.appointmentId,
          recordedBy: staffUserId,
          recordedByName: staffName,
          bpSystolic: data.bpSystolic,
          bpDiastolic: data.bpDiastolic,
          bloodPressure: bp,
          pulseRate: data.pulseRate,
          temperature: data.temperature,
          spo2: data.spo2,
          weight: data.weight,
          height: data.height,
          notes: data.notes,
        },
      });

      // 2. Mark appointment status to WAITING if currently CONFIRMED
      if (apt.status === 'CONFIRMED') {
        await tx.appointment.update({
          where: { id: data.appointmentId },
          data: { status: 'WAITING' },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: staffUserId,
          action: 'RECORD_PATIENT_VITALS',
          entity: 'PatientVital',
          entityId: vital.id,
          details: JSON.stringify({
            patientName: apt.patient.fullName,
            tokenNumber: apt.tokenNumber,
            bloodPressure: bp,
            pulseRate: data.pulseRate,
          }),
        },
      });

      return vital;
    });
  }

  static async getVitalsByAppointment(hospitalId: string, appointmentId: string) {
    return prisma.patientVital.findMany({
      where: { appointmentId, hospitalId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
