import prisma from '../config/prisma';
import { AuditService } from '../utils/audit';

export class PharmacyService {
  static async getPrescriptions(pharmacyId?: string, hospitalId?: string, status?: string) {
    const where: any = {};

    if (pharmacyId) {
      where.pharmacyId = pharmacyId;
    } else if (hospitalId) {
      where.hospitalId = hospitalId;
    }

    if (status) {
      where.pharmacyStatus = status;
    } else {
      where.pharmacyStatus = { in: ['SENT', 'ACCEPTED', 'PROCESSING', 'COMPLETED'] };
    }

    const prescriptions = await prisma.prescription.findMany({
      where,
      include: {
        appointment: {
          select: {
            appointmentNumber: true,
            appointmentDate: true,
            timeSlot: true,
            status: true,
          },
        },
        patient: {
          select: {
            id: true,
            fullName: true,
            mobileNumber: true,
            patientIdNumber: true,
            gender: true,
            dateOfBirth: true,
            age: true,
          },
        },
        doctor: {
          select: {
            id: true,
            name: true,
            specialization: true,
            qualification: true,
          },
        },
        hospital: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return prescriptions.map((p) => ({
      ...p,
      medicinesList: JSON.parse(p.medicines || '[]'),
    }));
  }

  static async updateStatus(
    prescriptionId: string,
    pharmacyId: string | undefined,
    status: 'ACCEPTED' | 'PROCESSING' | 'COMPLETED',
    staffUserId: string,
    staffName: string
  ) {
    const existing = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: { patient: true, doctor: true },
    });

    if (!existing) throw new Error('Prescription not found');

    const updateData: any = {
      pharmacyStatus: status,
    };

    if (status === 'COMPLETED') {
      updateData.dispensedAt = new Date();
      updateData.dispensedBy = staffName;
    }

    if (pharmacyId && !existing.pharmacyId) {
      updateData.pharmacyId = pharmacyId;
    }

    const updated = await prisma.prescription.update({
      where: { id: prescriptionId },
      data: updateData,
    });

    await AuditService.log({
      userId: staffUserId,
      action: 'UPDATE_PRESCRIPTION_PHARMACY_STATUS',
      entity: 'Prescription',
      entityId: prescriptionId,
      details: {
        status,
        patientName: existing.patient?.fullName,
        doctorName: existing.doctor?.name,
      },
    });

    return {
      ...updated,
      medicinesList: JSON.parse(updated.medicines || '[]'),
    };
  }
}
