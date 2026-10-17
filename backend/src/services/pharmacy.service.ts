import prisma from '../config/prisma';
import { AuditService } from '../utils/audit';
import { NotificationService } from './notification.service';
import { generateClinicalConsultationPdf } from '../utils/pdf';
import { resolveConsultationVitals, formatBP } from '../utils/vitals';
import { sortMedicinesByPriority } from '../utils/medicines';

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
            vitals: { orderBy: { createdAt: 'desc' }, take: 1 },
            medicalRecord: true,
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
            bloodGroup: true,
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
      vitals: resolveConsultationVitals(p),
      medicinesList: sortMedicinesByPriority(JSON.parse(p.medicines || '[]')),
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

  static async replaceMedicine(
    prescriptionId: string,
    pharmacyId: string | undefined,
    data: {
      medicineIndex: number;
      originalName?: string;
      replacement: {
        name: string;
        dosage?: string;
        frequency?: string;
        duration?: string;
        instructions?: string;
        strength?: string;
        formulation?: string;
        quantity?: any;
      };
      reason: string;
      doctorApproved?: boolean;
    },
    staffUserId: string,
    staffName: string
  ) {
    const existing = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        appointment: true,
        patient: true,
        doctor: true,
        hospital: true,
      },
    });

    if (!existing) {
      throw new Error('Prescription not found');
    }

    if (!data.replacement?.name || !data.replacement.name.trim()) {
      throw new Error('Replacement medicine name is required');
    }

    if (!data.reason || !data.reason.trim()) {
      throw new Error('Reason for medicine substitution is required');
    }

    let medicinesList: any[] = [];
    try {
      medicinesList = JSON.parse(existing.medicines || '[]');
    } catch {
      medicinesList = [];
    }

    const idx = data.medicineIndex;
    if (idx < 0 || idx >= medicinesList.length) {
      throw new Error(`Invalid medicine index: ${idx}`);
    }

    const targetMed = medicinesList[idx];
    const originalMedicineName =
      targetMed.isSubstituted && targetMed.originalMedicine ? targetMed.originalMedicine : targetMed.name;

    const substitutedItem = {
      name: data.replacement.name.trim(),
      priority: targetMed.priority,
      dosage: data.replacement.dosage?.trim() || targetMed.dosage || '1 dose',
      frequency: data.replacement.frequency?.trim() || targetMed.frequency || '1-0-1',
      duration: data.replacement.duration?.trim() || targetMed.duration || '5 days',
      instructions: data.replacement.instructions?.trim() || targetMed.instructions || 'As advised',
      strength: data.replacement.strength?.trim() || undefined,
      formulation: data.replacement.formulation?.trim() || undefined,
      quantity: data.replacement.quantity || undefined,
      isSubstituted: true,
      originalMedicine: originalMedicineName,
      originalDosage: targetMed.originalDosage || targetMed.dosage,
      originalFrequency: targetMed.originalFrequency || targetMed.frequency,
      originalDuration: targetMed.originalDuration || targetMed.duration,
      substitutionReason: data.reason.trim(),
      substitutedBy: staffName,
      substitutedAt: new Date().toISOString(),
      doctorApproved: data.doctorApproved !== false,
    };

    medicinesList[idx] = substitutedItem;
    medicinesList = sortMedicinesByPriority(medicinesList);

    const updateData: any = {
      medicines: JSON.stringify(medicinesList),
    };

    if (pharmacyId && !existing.pharmacyId) {
      updateData.pharmacyId = pharmacyId;
    }

    if (existing.pharmacyStatus === 'SENT') {
      updateData.pharmacyStatus = 'ACCEPTED';
    }

    const updated = await prisma.prescription.update({
      where: { id: prescriptionId },
      data: updateData,
      include: {
        appointment: true,
        patient: true,
        doctor: true,
        hospital: true,
      },
    });

    await AuditService.log({
      userId: staffUserId,
      action: 'REPLACE_PRESCRIPTION_MEDICINE',
      entity: 'Prescription',
      entityId: prescriptionId,
      details: {
        prescriptionId,
        appointmentNumber: existing.appointment?.appointmentNumber,
        originalMedicine: originalMedicineName,
        replacementMedicine: substitutedItem.name,
        substitutionReason: data.reason.trim(),
        substitutedBy: staffName,
        patientName: existing.patient?.fullName,
        doctorName: existing.doctor?.name,
      },
    });

    if (existing.doctor?.userId) {
      await NotificationService.createNotification({
        hospitalId: existing.hospitalId || existing.doctor.hospitalId,
        recipientType: 'DOCTOR',
        recipientId: existing.doctor.userId,
        title: 'Prescription Medicine Substituted',
        message: `Pharmacy substituted "${originalMedicineName}" with "${substitutedItem.name}" for patient ${existing.patient?.fullName || 'Patient'} (Reason: ${data.reason.trim()}).`,
        type: 'STATUS_CHANGED',
        metadata: {
          prescriptionId,
          appointmentId: existing.appointmentId,
          originalMedicine: originalMedicineName,
          replacementMedicine: substitutedItem.name,
        },
      });
    }

    return {
      ...updated,
      medicinesList,
    };
  }

  static async generatePrescriptionPdf(prescriptionId: string): Promise<Buffer> {
    const rx = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        appointment: {
          include: {
            vitals: { orderBy: { createdAt: 'desc' }, take: 1 },
            medicalRecord: true,
            labRequests: { include: { report: true, lab: true } },
          },
        },
        patient: {
          include: {
            vitals: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
        doctor: {
          include: {
            department: true,
          },
        },
        hospital: true,
      },
    });

    if (!rx) {
      throw new Error('Prescription not found');
    }

    let parsedMedicines: any[] = [];
    try {
      parsedMedicines = sortMedicinesByPriority(JSON.parse(rx.medicines || '[]'));
    } catch {
      parsedMedicines = [];
    }

    const parsedVitals = resolveConsultationVitals(rx);

    const labTestsList: Array<{ name: string; status: string; category?: string }> = [];
    if (rx.appointment?.labRequests && rx.appointment.labRequests.length > 0) {
      for (const req of rx.appointment.labRequests) {
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
      appointmentNumber: rx.appointment?.appointmentNumber || `APT-${rx.id.slice(0, 8).toUpperCase()}`,
      consultationDate: rx.appointment?.appointmentDate || new Date(rx.createdAt).toISOString().split('T')[0],
      tokenNumber: rx.appointment?.tokenNumber || 1,
      letterheadHeight: (rx.hospital as any)?.letterheadHeight || 144,
      hospital: {
        name: rx.hospital?.name || 'RocketWheel MedPulse Hospital',
        address: rx.hospital?.address || 'Hospital Road',
        city: rx.hospital?.city || 'City Center',
        phone: rx.hospital?.phone || '+91 99999 99999',
        email: rx.hospital?.email || undefined,
      },
      doctor: {
        name: rx.doctor.name,
        qualification: rx.doctor.qualification,
        specialization: rx.doctor.specialization,
        department: rx.doctor.department?.name,
      },
      patient: {
        fullName: rx.patient?.fullName || 'Walk-in Patient',
        patientIdNumber: rx.patient?.patientIdNumber || 'MRN-Pending',
        mobileNumber: rx.patient?.mobileNumber || '9999999999',
        age: rx.patient?.age,
        gender: rx.patient?.gender,
        bloodGroup: rx.patient?.bloodGroup,
      },
      chiefComplaints: rx.appointment?.medicalRecord?.symptoms || null,
      examination: rx.appointment?.medicalRecord?.examination || rx.examination || null,
      vitals: parsedVitals,
      diagnosis: rx.diagnosis || 'Clinical evaluation completed',
      medicines: parsedMedicines,
      labRequests: labTestsList,
      clinicalNotes: rx.appointment?.medicalRecord?.clinicalNotes || rx.appointment?.notes || null,
      instructions: rx.instructions || null,
      followUpDate: rx.followUpDate || null,
    });

    return pdfBuffer;
  }
}
