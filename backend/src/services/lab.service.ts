import crypto from 'crypto';
import prisma from '../config/prisma';
import { AuditService } from '../utils/audit';
import { NotificationService } from './notification.service';

export class LabService {
  /**
   * Fetch lab test requests scoped to a laboratory, with optional status filter
   */
  static async getTestRequests(labId: string, status?: string) {
    const where: any = { labId };

    if (status && status !== 'ALL') {
      const upper = status.toUpperCase();
      if (upper === 'RECEIVED' || upper === 'ACCEPTED') {
        where.status = { in: ['ACCEPTED', 'RECEIVED', 'APPROVED'] };
      } else if (upper === 'CANCELLED' || upper === 'REJECTED') {
        where.status = { in: ['CANCELLED', 'REJECTED'] };
      } else {
        where.status = upper;
      }
    }

    const requests = await prisma.labTestRequest.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            fullName: true,
            mobileNumber: true,
            patientIdNumber: true,
            gender: true,
            dateOfBirth: true,
            bloodGroup: true,
          },
        },
        doctor: { select: { id: true, name: true, specialization: true } },
        hospital: { select: { id: true, name: true, code: true } },
        report: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((r) => {
      let parsedTests = [];
      try {
        parsedTests = JSON.parse(r.tests || '[]');
      } catch {
        parsedTests = [{ name: r.tests }];
      }
      return {
        ...r,
        testsList: parsedTests,
      };
    });
  }

  /**
   * Update request status (supports ACCEPTED, RECEIVED, PROCESSING, CANCELLED, REJECTED)
   */
  static async updateRequestStatus(
    labId: string,
    requestId: string,
    rawStatus: string,
    technicianUserId?: string
  ) {
    const request = await prisma.labTestRequest.findFirst({
      where: { id: requestId, labId },
      include: { patient: true },
    });
    if (!request) {
      throw new Error('Diagnostic requisition not found for this laboratory.');
    }

    const upper = (rawStatus || '').toUpperCase().trim();
    let normalizedStatus = upper;

    if (upper === 'APPROVED' || upper === 'RECEIVED' || upper === 'ACCEPTED') {
      normalizedStatus = 'ACCEPTED';
    } else if (upper === 'REJECTED' || upper === 'CANCELLED') {
      normalizedStatus = 'CANCELLED';
    } else if (upper === 'PROCESSING') {
      normalizedStatus = 'PROCESSING';
    } else if (upper === 'COMPLETED') {
      normalizedStatus = 'COMPLETED';
    } else {
      throw new Error(`Invalid status transition to '${rawStatus}'. Allowed: ACCEPTED, PROCESSING, CANCELLED.`);
    }

    const updated = await prisma.labTestRequest.update({
      where: { id: requestId },
      data: { status: normalizedStatus },
      include: { patient: true, doctor: true, report: true },
    });

    await AuditService.log({
      userId: technicianUserId,
      action: 'UPDATE_LAB_REQUEST_STATUS',
      entity: 'LabTestRequest',
      entityId: requestId,
      details: {
        rawStatus,
        normalizedStatus,
        requestNumber: request.requestNumber,
        patientName: request.patient.fullName,
      },
    });

    if (request.hospitalId) {
      const isApproved = normalizedStatus === 'ACCEPTED';
      const isRejected = normalizedStatus === 'CANCELLED';
      const notifType = isApproved ? 'LAB_REQUEST_APPROVED' : isRejected ? 'LAB_REQUEST_REJECTED' : 'STATUS_CHANGED';
      const notifTitle = isApproved ? 'Lab Request Approved' : isRejected ? 'Lab Request Rejected' : `Lab Request ${normalizedStatus}`;
      await NotificationService.createNotification({
        hospitalId: request.hospitalId,
        recipientType: 'DOCTOR',
        recipientId: request.doctorId,
        title: notifTitle,
        message: `Requisition #${request.requestNumber} for ${request.patient.fullName} marked as ${normalizedStatus}.`,
        type: notifType,
        metadata: { requestId: request.id, requestNumber: request.requestNumber, status: normalizedStatus },
      });
    }

    return updated;
  }

  /**
   * Submit diagnostic report
   */
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

      let validUserId: string | null = null;
      if (technicianUserId) {
        const userExists = await tx.user.findUnique({ where: { id: technicianUserId }, select: { id: true } });
        if (userExists) validUserId = userExists.id;
      }

      try {
        await tx.auditLog.create({
          data: {
            userId: validUserId,
            action: 'SUBMIT_LAB_REPORT',
            entity: 'LabReport',
            entityId: report.id,
            details: JSON.stringify({
              requestNumber: request.requestNumber,
              patientName: request.patient.fullName,
              technicianId: technicianUserId,
            }),
          },
        });
      } catch (auditErr) {
        console.warn('AuditLog creation skipped in submitReport:', auditErr);
      }

      return report;
    });
  }

  // -------------------------------------------------------------
  // LAB TEST CATALOG & PRICE MANAGEMENT (CRUD)
  // -------------------------------------------------------------
  static async getLabTests(labId: string, category?: string, search?: string) {
    const where: any = { labId };
    if (category && category !== 'ALL') {
      where.category = category;
    }
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { code: { contains: q } },
        { description: { contains: q } },
      ];
    }

    return prisma.labTest.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  static async createLabTest(
    labId: string,
    data: {
      code?: string | null;
      name: string;
      category?: string | null;
      description?: string | null;
      tatHours?: number | null;
      price: number;
      status?: string;
    },
    requestingUserId?: string
  ) {
    const lab = await prisma.lab.findUnique({ where: { id: labId } });
    if (!lab) throw new Error('Laboratory not found');

    const cleanCode = data.code ? data.code.trim().toUpperCase() : `LT-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    // Check duplicate code within this lab
    const existing = await prisma.labTest.findFirst({
      where: { labId, code: cleanCode },
    });
    if (existing) {
      throw new Error(`A test with code '${cleanCode}' already exists in your catalog.`);
    }

    const test = await prisma.labTest.create({
      data: {
        labId,
        hospitalId: lab.hospitalId,
        code: cleanCode,
        name: data.name.trim(),
        category: data.category?.trim() || 'General Pathology',
        description: data.description?.trim() || null,
        tatHours: data.tatHours ? Number(data.tatHours) : 24,
        price: Number(data.price),
        status: data.status || 'ACTIVE',
      },
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'CREATE_LAB_TEST',
      entity: 'LabTest',
      entityId: test.id,
      details: { code: test.code, name: test.name, price: test.price },
    });

    return test;
  }

  static async updateLabTest(
    labId: string,
    testId: string,
    data: {
      code?: string | null;
      name?: string;
      category?: string | null;
      description?: string | null;
      tatHours?: number | null;
      price?: number;
      status?: string;
    },
    requestingUserId?: string
  ) {
    const existing = await prisma.labTest.findFirst({ where: { id: testId, labId } });
    if (!existing) throw new Error('Diagnostic test not found in this laboratory catalog');

    const updated = await prisma.labTest.update({
      where: { id: testId },
      data: {
        code: data.code !== undefined ? (data.code ? data.code.trim().toUpperCase() : null) : existing.code,
        name: data.name !== undefined ? data.name.trim() : existing.name,
        category: data.category !== undefined ? data.category?.trim() : existing.category,
        description: data.description !== undefined ? data.description?.trim() : existing.description,
        tatHours: data.tatHours !== undefined ? Number(data.tatHours) : existing.tatHours,
        price: data.price !== undefined ? Number(data.price) : existing.price,
        status: data.status !== undefined ? data.status : existing.status,
      },
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'UPDATE_LAB_TEST',
      entity: 'LabTest',
      entityId: testId,
      details: { name: updated.name, price: updated.price },
    });

    return updated;
  }

  static async toggleLabTestStatus(labId: string, testId: string, requestingUserId?: string) {
    const existing = await prisma.labTest.findFirst({ where: { id: testId, labId } });
    if (!existing) throw new Error('Test not found');

    const newStatus = existing.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const updated = await prisma.labTest.update({
      where: { id: testId },
      data: { status: newStatus },
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'TOGGLE_LAB_TEST_AVAILABILITY',
      entity: 'LabTest',
      entityId: testId,
      details: { status: updated.status },
    });

    return updated;
  }

  static async deleteLabTest(labId: string, testId: string, requestingUserId?: string) {
    const existing = await prisma.labTest.findFirst({ where: { id: testId, labId } });
    if (!existing) throw new Error('Test not found');

    await prisma.labTest.delete({ where: { id: testId } });

    await AuditService.log({
      userId: requestingUserId,
      action: 'DELETE_LAB_TEST',
      entity: 'LabTest',
      entityId: testId,
      details: { name: existing.name, code: existing.code },
    });

    return { success: true };
  }

  // -------------------------------------------------------------
  // PUBLIC & CUSTOMER-FACING LAB CATALOG & BOOKING
  // -------------------------------------------------------------

  /**
   * Get all accredited/approved active laboratories with test counts
   */
  static async getActiveLabs(hospitalId?: string, isPublicOnly: boolean = false) {
    const where: any = {
      status: { in: ['APPROVED', 'ACTIVE'] },
    };
    if (hospitalId) {
      where.hospitalId = hospitalId;
    }
    if (isPublicOnly) {
      where.visibility = 'PUBLIC';
    }

    const labs = await prisma.lab.findMany({
      where,
      include: {
        hospital: { select: { id: true, name: true, code: true, city: true, phone: true } },
        _count: {
          select: { tests: true, testRequests: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return labs.map((l) => ({
      id: l.id,
      name: l.name,
      type: l.type,
      licenseNumber: l.licenseNumber,
      status: l.status,
      visibility: l.visibility,
      hospital: l.hospital,
      testsCount: l._count.tests,
      requestsCount: l._count.testRequests,
    }));
  }

  /**
   * Public search across all available tests from active/approved labs
   */
  static async getPublicLabTests(labId?: string, category?: string, search?: string) {
    const where: any = {
      status: 'ACTIVE',
      lab: {
        status: { in: ['APPROVED', 'ACTIVE'] },
        visibility: 'PUBLIC',
      },
    };

    if (labId) {
      where.labId = labId;
    }
    if (category && category !== 'ALL') {
      where.category = category;
    }
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { code: { contains: q } },
        { description: { contains: q } },
      ];
    }

    return prisma.labTest.findMany({
      where,
      include: {
        lab: {
          select: {
            id: true,
            name: true,
            type: true,
            visibility: true,
            hospital: { select: { id: true, name: true, city: true } },
          },
        },
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Customer-direct lab test booking flow
   */
  static async bookCustomerLabTest(data: {
    labId: string;
    patientName: string;
    mobileNumber: string;
    email?: string;
    gender?: string;
    age?: number;
    address?: string;
    preferredDate?: string;
    testIds: string[];
    notes?: string;
  }) {
    const { labId, patientName, mobileNumber, email, gender, age, address, preferredDate, testIds, notes } = data;

    if (!labId) throw new Error('Please select a diagnostic laboratory.');
    if (!patientName || !mobileNumber) throw new Error('Patient name and mobile number are required.');
    if (!testIds || !Array.isArray(testIds) || testIds.length === 0) {
      throw new Error('Please select at least one laboratory test to book.');
    }

    const lab = await prisma.lab.findFirst({
      where: { id: labId, status: { in: ['APPROVED', 'ACTIVE'] } },
      include: { hospital: true },
    });
    if (!lab) {
      throw new Error('Selected laboratory is currently not accepting bookings.');
    }
    if (lab.visibility === 'PRIVATE') {
      throw new Error('This hospital diagnostic laboratory is private and does not accept direct public bookings. Tests must be ordered by a hospital clinician.');
    }

    // Retrieve selected tests to get live pricing
    const tests = await prisma.labTest.findMany({
      where: {
        id: { in: testIds },
        labId,
        status: 'ACTIVE',
      },
    });

    if (tests.length === 0) {
      throw new Error('None of the selected tests are currently available at this laboratory.');
    }

    const totalAmount = tests.reduce((sum, t) => sum + t.price, 0);

    // Upsert / locate patient record
    let patient = await prisma.patient.findFirst({
      where: {
        mobileNumber,
        ...(lab.hospitalId ? { hospitalId: lab.hospitalId } : {}),
      },
    });

    if (!patient) {
      const patientIdNumber = `MRN-LAB-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      patient = await prisma.patient.create({
        data: {
          hospitalId: lab.hospitalId || undefined,
          patientIdNumber,
          fullName: patientName.trim(),
          mobileNumber: mobileNumber.trim(),
          email: email?.trim() || '',
          gender: gender || 'OTHER',
          address: address?.trim() || null,
        },
      });
    }

    // Generate unique requisition number
    const randPart = crypto.randomBytes(2).toString('hex').toUpperCase();
    const datePart = (preferredDate || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
    const requestNumber = `LAB-${datePart}-${randPart}`;

    const formattedTests = tests.map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      category: t.category,
      price: t.price,
      tatHours: t.tatHours,
    }));

    const booking = await prisma.labTestRequest.create({
      data: {
        requestNumber,
        labId,
        hospitalId: lab.hospitalId || undefined,
        patientId: patient.id,
        tests: JSON.stringify(formattedTests),
        clinicalNotes: notes?.trim() || 'Direct Customer Online Booking',
        priority: 'NORMAL',
        status: 'REQUESTED',
        preferredDate: preferredDate || null,
        totalAmount,
      },
      include: {
        patient: true,
        lab: { select: { id: true, name: true, type: true } },
      },
    });

    await AuditService.log({
      action: 'CUSTOMER_LAB_BOOKING',
      entity: 'LabTestRequest',
      entityId: booking.id,
      details: {
        requestNumber,
        patientName,
        testsCount: tests.length,
        totalAmount,
      },
    });

    return {
      success: true,
      requestNumber: booking.requestNumber,
      id: booking.id,
      patientName: patient.fullName,
      labName: lab.name,
      tests: formattedTests,
      totalAmount,
      preferredDate,
      status: booking.status,
    };
  }

  /**
   * Track booking status by request number
   */
  static async getBookingStatus(requestNumberOrId: string) {
    const booking = await prisma.labTestRequest.findFirst({
      where: {
        OR: [{ requestNumber: requestNumberOrId }, { id: requestNumberOrId }],
      },
      include: {
        patient: { select: { fullName: true, mobileNumber: true, patientIdNumber: true } },
        lab: { select: { id: true, name: true, type: true } },
        hospital: { select: { name: true, city: true } },
        report: true,
      },
    });

    if (!booking) throw new Error('Requisition record not found.');

    return {
      ...booking,
      testsList: JSON.parse(booking.tests || '[]'),
    };
  }
}
