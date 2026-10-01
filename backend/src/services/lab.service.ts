import prisma from '../config/prisma';
import { AuditService } from '../utils/audit';

export class LabService {
  static async getTestRequests(labId: string, status?: string) {
    const where: any = { labId };
    if (status) {
      where.status = status;
    }

    const requests = await prisma.labTestRequest.findMany({
      where,
      include: {
        patient: { select: { id: true, fullName: true, mobileNumber: true, patientIdNumber: true, gender: true, dateOfBirth: true } },
        doctor: { select: { id: true, name: true, specialization: true } },
        hospital: { select: { id: true, name: true, code: true } },
        report: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((r) => ({
      ...r,
      testsList: JSON.parse(r.tests || '[]'),
    }));
  }

  static async updateRequestStatus(
    labId: string,
    requestId: string,
    status: 'ACCEPTED' | 'PROCESSING' | 'CANCELLED',
    technicianUserId?: string
  ) {
    const request = await prisma.labTestRequest.findFirst({ where: { id: requestId, labId } });
    if (!request) throw new Error('Test request not found for this laboratory');

    const updated = await prisma.labTestRequest.update({
      where: { id: requestId },
      data: { status },
      include: { patient: true, doctor: true },
    });

    await AuditService.log({
      userId: technicianUserId,
      action: 'UPDATE_LAB_REQUEST_STATUS',
      entity: 'LabTestRequest',
      entityId: requestId,
      details: { status, requestNumber: request.requestNumber },
    });

    return updated;
  }

  static async submitReport(
    labId: string,
    requestId: string,
    data: { results: string; fileUrl?: string | null; remarks?: string | null },
    technicianUserId: string,
    technicianName: string
  ) {
    const request = await prisma.labTestRequest.findFirst({
      where: { id: requestId, labId },
      include: { patient: true, doctor: true },
    });
    if (!request) throw new Error('Test request not found for this laboratory');

    return prisma.$transaction(async (tx) => {
      // 1. Create or update LabReport
      const report = await tx.labReport.upsert({
        where: { testRequestId: requestId },
        update: {
          results: data.results,
          fileUrl: data.fileUrl,
          remarks: data.remarks,
          technicianId: technicianUserId,
          technicianName,
          completedAt: new Date(),
        },
        create: {
          testRequestId: requestId,
          results: data.results,
          fileUrl: data.fileUrl,
          remarks: data.remarks,
          technicianId: technicianUserId,
          technicianName,
          completedAt: new Date(),
        },
      });

      // 2. Mark request as COMPLETED
      await tx.labTestRequest.update({
        where: { id: requestId },
        data: { status: 'COMPLETED' },
      });

      await tx.auditLog.create({
        data: {
          userId: technicianUserId,
          action: 'SUBMIT_LAB_REPORT',
          entity: 'LabReport',
          entityId: report.id,
          details: JSON.stringify({ requestNumber: request.requestNumber, patientName: request.patient.fullName }),
        },
      });

      return report;
    });
  }
}
