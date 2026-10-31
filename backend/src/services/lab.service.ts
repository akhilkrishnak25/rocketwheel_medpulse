import crypto from 'crypto';
import ExcelJS from 'exceljs';
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

    where.NOT = {
      appointment: {
        status: 'DRAFT',
      },
    };

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
      include: { patient: true, appointment: true },
    });
    if (!request) {
      throw new Error('Diagnostic requisition not found for this laboratory.');
    }
    if (request.appointment && request.appointment.status === 'DRAFT') {
      throw new Error('Cannot process laboratory requisition for an OP consultation that is currently in draft.');
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
  // BULK IMPORT & EXPORT OF LAB TESTS (MASTER CATALOG)
  // -------------------------------------------------------------

  /**
   * Helper to resolve labId for Lab Technician, Hospital Admin, or Super Admin
   */
  static async resolveLabForUser(user: any): Promise<string> {
    if (user?.labId) return user.labId;

    if (user?.hospitalId) {
      let lab = await prisma.lab.findFirst({
        where: { hospitalId: user.hospitalId },
      });
      if (!lab) {
        const hospital = await prisma.hospital.findUnique({ where: { id: user.hospitalId } });
        lab = await prisma.lab.create({
          data: {
            hospitalId: user.hospitalId,
            name: `${hospital?.name || 'Hospital'} Diagnostic Laboratory`,
            type: 'HOSPITAL',
            email: hospital?.email || 'lab@hospital.com',
            phone: hospital?.phone || '0000000000',
            status: 'APPROVED',
            visibility: 'PUBLIC',
          },
        });
      }
      return lab.id;
    }

    // Fallback to first available approved lab
    const firstLab = await prisma.lab.findFirst({ where: { status: { in: ['APPROVED', 'ACTIVE'] } } });
    if (firstLab) return firstLab.id;

    throw new Error('No laboratory or hospital affiliation found for your session.');
  }

  /**
   * Generate downloadable sample Excel/CSV template for bulk test import
   */
  static async generateSampleTemplate(format: 'xlsx' | 'csv' = 'xlsx'): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RocketWheel MedPulse Platform';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Lab Tests Template');
    sheet.columns = [
      { header: 'Test Name', key: 'name', width: 34 },
      { header: 'Test Code', key: 'code', width: 16 },
      { header: 'Category', key: 'category', width: 22 },
      { header: 'Department', key: 'department', width: 22 },
      { header: 'Description', key: 'description', width: 45 },
      { header: 'Price', key: 'price', width: 16 },
    ];

    // Apply clean header styling
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF7C3AED' }, // MedPulse Purple
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 28;

    // Sample diagnostic master records
    const sampleTests = [
      {
        name: 'Complete Blood Count (CBC)',
        code: 'CBC-01',
        category: 'Hematology',
        department: 'Pathology',
        description: 'Comprehensive blood cell count with differential, platelets, and RBC indices',
        price: 350,
      },
      {
        name: 'Lipid Profile Complete',
        code: 'LIPID-01',
        category: 'Biochemistry',
        department: 'Clinical Biochemistry',
        description: 'Measures Total Cholesterol, Triglycerides, HDL, LDL, and VLDL ratios',
        price: 650,
      },
      {
        name: 'Liver Function Test (LFT)',
        code: 'LFT-01',
        category: 'Biochemistry',
        department: 'Clinical Biochemistry',
        description: 'Evaluates Bilirubin, SGOT/AST, SGPT/ALT, Alkaline Phosphatase, and Total Protein',
        price: 750,
      },
      {
        name: 'Fasting Blood Sugar (FBS)',
        code: 'FBS-01',
        category: 'Clinical Pathology',
        department: 'Pathology',
        description: 'Plasma glucose test measured after an 8 to 12 hour overnight fast',
        price: 120,
      },
      {
        name: 'Thyroid Profile Total (T3, T4, TSH)',
        code: 'THY-01',
        category: 'Endocrinology',
        department: 'Clinical Biochemistry',
        description: 'Complete quantitative evaluation of thyroid hormones via chemiluminescence',
        price: 600,
      },
      {
        name: 'Urine Routine & Microscopic Examination',
        code: 'URINE-01',
        category: 'Pathology',
        department: 'Microbiology',
        description: 'Physical, chemical, and microscopic examination of clean-catch urine specimen',
        price: 150,
      },
    ];

    sampleTests.forEach((t) => {
      const row = sheet.addRow(t);
      row.alignment = { vertical: 'middle', horizontal: 'left' };
      row.font = { size: 9.5 };
    });

    if (format === 'csv') {
      const csvBuffer = await workbook.csv.writeBuffer();
      return {
        buffer: Buffer.from(csvBuffer),
        contentType: 'text/csv',
        filename: 'Lab_Tests_Sample_Template.csv',
      };
    }

    const xlsxBuffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(xlsxBuffer),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: 'Lab_Tests_Sample_Template.xlsx',
    };
  }

  /**
   * Parse uploaded Excel (.xlsx, .xls) or CSV buffer into structured raw rows
   */
  static async parseUploadedLabTestFile(buffer: Buffer, fileName: string): Promise<any[]> {
    const isCsv = fileName.toLowerCase().endsWith('.csv');

    if (isCsv) {
      const text = buffer.toString('utf8');
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length <= 1) return [];

      // Parse CSV line supporting quotes
      const parseCsvLine = (line: string): string[] => {
        const result: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"' || char === "'") {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(cur.trim().replace(/^["']|["']$/g, ''));
            cur = '';
          } else {
            cur += char;
          }
        }
        result.push(cur.trim().replace(/^["']|["']$/g, ''));
        return result;
      };

      const headerCells = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
      const nameIdx = headerCells.findIndex((h) => h.includes('name') || h === 'test');
      const codeIdx = headerCells.findIndex((h) => h.includes('code'));
      const catIdx = headerCells.findIndex((h) => h.includes('category'));
      const deptIdx = headerCells.findIndex((h) => h.includes('dept') || h.includes('department'));
      const descIdx = headerCells.findIndex((h) => h.includes('desc') || h.includes('detail'));
      const priceIdx = headerCells.findIndex((h) => h.includes('price') || h.includes('fee') || h.includes('cost') || h.includes('rate'));

      const rows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cells = parseCsvLine(lines[i]);
        if (cells.length === 0 || cells.every((c) => !c)) continue;
        rows.push({
          rowNumber: i + 1,
          name: nameIdx !== -1 ? cells[nameIdx] : cells[0] || '',
          code: codeIdx !== -1 ? cells[codeIdx] : cells[1] || '',
          category: catIdx !== -1 ? cells[catIdx] : cells[2] || '',
          department: deptIdx !== -1 ? cells[deptIdx] : cells[3] || '',
          description: descIdx !== -1 ? cells[descIdx] : cells[4] || '',
          price: priceIdx !== -1 ? cells[priceIdx] : cells[5] || 0,
        });
      }
      return rows;
    }

    // Excel workbook parsing (.xlsx / .xls)
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];

    const headerRow = sheet.getRow(1);
    const headerMap: Record<string, number> = {};
    headerRow.eachCell((cell, colNumber) => {
      const val = String(cell.value || '').toLowerCase().trim();
      if (val.includes('name') || val === 'test') headerMap.name = colNumber;
      if (val.includes('code')) headerMap.code = colNumber;
      if (val.includes('category')) headerMap.category = colNumber;
      if (val.includes('dept') || val.includes('department')) headerMap.department = colNumber;
      if (val.includes('desc') || val.includes('detail')) headerMap.description = colNumber;
      if (val.includes('price') || val.includes('fee') || val.includes('cost') || val.includes('rate')) headerMap.price = colNumber;
    });

    const rows: any[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header row
      const getVal = (col?: number) => {
        if (!col) return '';
        const c = row.getCell(col);
        if (c.value === null || c.value === undefined) return '';
        if (typeof c.value === 'object' && 'result' in c.value) return String(c.value.result ?? '');
        if (typeof c.value === 'object' && 'text' in c.value) return String(c.value.text ?? '');
        return String(c.value).trim();
      };

      const name = getVal(headerMap.name || 1);
      const code = getVal(headerMap.code || 2);
      const category = getVal(headerMap.category || 3);
      const department = getVal(headerMap.department || 4);
      const description = getVal(headerMap.description || 5);
      const priceRaw = getVal(headerMap.price || 6);

      if (!name && !code && !priceRaw) return; // Skip empty row

      rows.push({
        rowNumber,
        name,
        code,
        category,
        department,
        description,
        price: priceRaw,
      });
    });

    return rows;
  }

  /**
   * Validate uploaded lab test rows, identify duplicates, and generate preview
   */
  static async validateAndPreviewImport(labId: string, rawRows: any[]): Promise<{
    records: any[];
    rows?: any[];
    summary: {
      total: number;
      valid: number;
      duplicates: number;
      errors: number;
      canImport: boolean;
    };
    totalRows?: number;
    validRows?: number;
    duplicateRows?: number;
    errorRows?: number;
    validCount?: number;
    duplicateCount?: number;
    errorCount?: number;
    canImport?: boolean;
  }> {
    // Fetch all existing tests in this laboratory to check against database duplicates
    const existingTests = await prisma.labTest.findMany({
      where: { labId },
      select: { id: true, name: true, code: true },
    });

    const existingNames = new Set(existingTests.map((t) => t.name.trim().toLowerCase()));
    const existingCodes = new Set(
      existingTests.map((t) => (t.code ? t.code.trim().toUpperCase() : '')).filter(Boolean)
    );

    const fileCodes = new Map<string, number>(); // code -> first rowNumber seen
    const fileNames = new Map<string, number>(); // name -> first rowNumber seen

    let validCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    const previewRecords = rawRows.map((row, index) => {
      const rowNum = row.rowNumber || index + 2;
      const rawName = String(row.name || '').trim();
      const rawCode = String(row.code || '').trim().toUpperCase();
      const rawCategory = String(row.category || '').trim() || 'Pathology';
      const rawDepartment = String(row.department || '').trim() || rawCategory || 'General Diagnostics';
      const rawDescription = String(row.description || '').trim();
      const parsedPrice = parseFloat(String(row.price).replace(/[^0-9.-]+/g, ''));

      const errors: string[] = [];
      let isDuplicate = false;
      let duplicateType: 'FILE' | 'DATABASE' | undefined;

      // 1. Mandatory Name Validation
      if (!rawName) {
        errors.push('Test Name is required and cannot be blank.');
      }

      // 2. Mandatory Price Validation
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        errors.push(`Invalid price "${row.price}". Must be a valid positive number.`);
      }

      // 3. Duplicate checks within uploaded file
      if (rawCode) {
        if (fileCodes.has(rawCode)) {
          isDuplicate = true;
          duplicateType = 'FILE';
          errors.push(`Duplicate Test Code "${rawCode}" in file (matches Row ${fileCodes.get(rawCode)}).`);
        } else {
          fileCodes.set(rawCode, rowNum);
        }
      }

      if (rawName) {
        const lowerName = rawName.toLowerCase();
        if (fileNames.has(lowerName)) {
          isDuplicate = true;
          duplicateType = 'FILE';
          errors.push(`Duplicate Test Name "${rawName}" in file (matches Row ${fileNames.get(lowerName)}).`);
        } else {
          fileNames.set(lowerName, rowNum);
        }
      }

      // 4. Duplicate checks against existing Database records
      if (rawCode && existingCodes.has(rawCode)) {
        isDuplicate = true;
        duplicateType = 'DATABASE';
        errors.push(`Test Code "${rawCode}" already exists in your laboratory catalog.`);
      }

      if (rawName && existingNames.has(rawName.toLowerCase())) {
        isDuplicate = true;
        duplicateType = 'DATABASE';
        errors.push(`Test Name "${rawName}" already exists in your laboratory catalog.`);
      }

      let rowStatus: 'VALID' | 'DUPLICATE' | 'ERROR' = 'VALID';
      if (errors.length > 0) {
        if (isDuplicate) {
          rowStatus = 'DUPLICATE';
          duplicateCount++;
        } else {
          rowStatus = 'ERROR';
          errorCount++;
        }
      } else {
        validCount++;
      }

      return {
        rowNumber: rowNum,
        name: rawName,
        code: rawCode || null,
        category: rawCategory,
        department: rawDepartment,
        description: rawDescription || null,
        price: isNaN(parsedPrice) ? 0 : parsedPrice,
        status: rowStatus,
        errors,
        isDuplicate,
        duplicateType,
        isValid: rowStatus === 'VALID',
        isExistingDuplicate: isDuplicate && duplicateType === 'DATABASE',
      };
    });

    return {
      records: previewRecords,
      rows: previewRecords,
      summary: {
        total: previewRecords.length,
        valid: validCount,
        duplicates: duplicateCount,
        errors: errorCount,
        canImport: validCount > 0,
      },
      totalRows: previewRecords.length,
      validCount,
      duplicateCount,
      errorCount,
      canImport: validCount > 0,
    };
  }

  /**
   * Execute bulk import of validated lab tests
   */
  static async importLabTests(
    labId: string,
    testsToImport: Array<{
      name: string;
      code?: string | null;
      category?: string | null;
      department?: string | null;
      description?: string | null;
      price: number;
    }>,
    requestingUserId?: string
  ): Promise<{
    importedCount: number;
    skippedCount: number;
    failedCount: number;
    results: any[];
    summary?: any;
  }> {
    const lab = await prisma.lab.findUnique({ where: { id: labId } });
    if (!lab) throw new Error('Laboratory not found');

    if (!Array.isArray(testsToImport) || testsToImport.length === 0) {
      throw new Error('No valid tests provided for bulk import');
    }

    // Final database safety check: fetch existing names & codes
    const existingTests = await prisma.labTest.findMany({
      where: { labId },
      select: { name: true, code: true },
    });
    const existingNames = new Set(existingTests.map((t) => t.name.trim().toLowerCase()));
    const existingCodes = new Set(
      existingTests.map((t) => (t.code ? t.code.trim().toUpperCase() : '')).filter(Boolean)
    );

    const validNewTests: any[] = [];
    let skippedCount = 0;

    for (const test of testsToImport) {
      const cleanName = (test.name || '').trim();
      const cleanCode = test.code
        ? test.code.trim().toUpperCase()
        : `LT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      if (!cleanName || existingNames.has(cleanName.toLowerCase()) || existingCodes.has(cleanCode)) {
        skippedCount++;
        continue;
      }

      existingNames.add(cleanName.toLowerCase());
      existingCodes.add(cleanCode);

      validNewTests.push({
        labId,
        hospitalId: lab.hospitalId,
        name: cleanName,
        code: cleanCode,
        category: (test.category || '').trim() || 'Pathology',
        department: (test.department || '').trim() || null,
        description: (test.description || '').trim() || null,
        price: Number(test.price) >= 0 ? Number(test.price) : 0,
        status: 'ACTIVE',
        tatHours: 24,
      });
    }

    if (validNewTests.length === 0) {
      return {
        importedCount: 0,
        skippedCount,
        failedCount: 0,
        results: [],
      };
    }

    // Insert all valid tests in a single transaction
    const created = await prisma.$transaction(
      validNewTests.map((t) => prisma.labTest.create({ data: t }))
    );

    await AuditService.log({
      userId: requestingUserId,
      action: 'BULK_IMPORT_LAB_TESTS',
      entity: 'LabTest',
      entityId: labId,
      details: {
        importedCount: created.length,
        skippedCount,
      },
    });

    return {
      importedCount: created.length,
      skippedCount,
      failedCount: 0,
      results: created,
      summary: {
        imported: created.length,
        duplicatesSkipped: skippedCount,
        errorsCount: 0,
      },
    };
  }

  /**
   * Export lab tests catalog with filtering options into Excel (.xlsx) or CSV (.csv)
   */
  static async exportLabTests(
    labId: string,
    filters: {
      category?: string;
      department?: string;
      status?: string;
      testIds?: string[];
      search?: string;
      format?: string;
    },
    format: 'xlsx' | 'csv' = 'xlsx'
  ): Promise<{ buffer: Buffer; contentType: string; filename: string; totalExported: number }> {
    const where: any = { labId };

    if (filters.category && filters.category !== 'ALL') {
      where.category = filters.category;
    }

    if (filters.department && filters.department !== 'ALL') {
      where.department = filters.department;
    }

    if (filters.status && filters.status !== 'ALL') {
      where.status = filters.status;
    }

    if (filters.testIds && filters.testIds.length > 0) {
      where.id = { in: filters.testIds };
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { code: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }

    const tests = await prisma.labTest.findMany({
      where,
      orderBy: [{ department: 'asc' }, { category: 'asc' }, { name: 'asc' }],
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RocketWheel MedPulse Platform';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Diagnostic Test Catalog');
    sheet.columns = [
      { header: 'Test Code', key: 'code', width: 16 },
      { header: 'Test Name', key: 'name', width: 34 },
      { header: 'Category', key: 'category', width: 22 },
      { header: 'Department', key: 'department', width: 22 },
      { header: 'Description', key: 'description', width: 45 },
      { header: 'Price (INR)', key: 'price', width: 16 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Turnaround Time (Hours)', key: 'tatHours', width: 25 },
      { header: 'Created Date', key: 'createdAt', width: 20 },
    ];

    // Header styling
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF6B21A8' }, // Rich Purple
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 28;

    tests.forEach((t) => {
      const row = sheet.addRow({
        code: t.code || '—',
        name: t.name,
        category: t.category || 'Pathology',
        department: t.department || t.category || 'Pathology',
        description: t.description || '—',
        price: t.price,
        status: t.status,
        tatHours: t.tatHours || 24,
        createdAt: new Date(t.createdAt).toLocaleDateString('en-IN'),
      });
      row.alignment = { vertical: 'middle', horizontal: 'left' };
      row.font = { size: 9.5 };
    });

    const dateTag = new Date().toISOString().split('T')[0];
    const resolvedFormat = (filters.format || format || 'xlsx').toLowerCase();
    if (resolvedFormat === 'csv') {
      const csvBuffer = await workbook.csv.writeBuffer();
      return {
        buffer: Buffer.from(csvBuffer),
        contentType: 'text/csv',
        filename: `Lab_Tests_Export_${dateTag}.csv`,
        totalExported: tests.length,
      };
    }

    const xlsxBuffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(xlsxBuffer),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `Lab_Tests_Export_${dateTag}.xlsx`,
      totalExported: tests.length,
    };
  }

  // -------------------------------------------------------------
  // PUBLIC & CUSTOMER-FACING LAB CATALOG & BOOKING
  // -------------------------------------------------------------

  /**
   * Get all accredited/approved active laboratories with test counts
   */
  static async getActiveLabs(hospitalId?: string, isPublicOnly: boolean = false, userHospitalId?: string) {
    const where: any = {
      status: { in: ['APPROVED', 'ACTIVE'] },
    };

    if (isPublicOnly) {
      where.visibility = 'PUBLIC';
      if (hospitalId) {
        where.hospitalId = hospitalId;
      }
    } else {
      // Clinician / Hospital Admin request: can access public labs + private labs affiliated with their hospital
      if (hospitalId) {
        where.hospitalId = hospitalId;
      } else if (userHospitalId) {
        where.OR = [
          { visibility: 'PUBLIC' },
          { hospitalId: userHospitalId },
        ];
      }
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
   * If userHospitalId is provided (e.g. Doctor requisition), includes tests from private labs of that hospital.
   */
  static async getPublicLabTests(labId?: string, category?: string, search?: string, userHospitalId?: string) {
    const where: any = {
      status: 'ACTIVE',
      lab: {
        status: { in: ['APPROVED', 'ACTIVE'] },
        ...(userHospitalId
          ? {
              OR: [
                { visibility: 'PUBLIC' },
                { hospitalId: userHospitalId },
              ],
            }
          : { visibility: 'PUBLIC' }),
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

    // Upsert / locate patient record using mobileNumber + fullName as identity key
    const cleanMobile = mobileNumber.trim();
    const cleanName = patientName.trim();

    const candidatePatients = await prisma.patient.findMany({
      where: {
        mobileNumber: cleanMobile,
        ...(lab.hospitalId ? { hospitalId: lab.hospitalId } : {}),
      },
    });

    let patient = candidatePatients.find(
      (p) => p.fullName.trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (!patient) {
      const patientIdNumber = `MRN-LAB-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      patient = await prisma.patient.create({
        data: {
          hospitalId: lab.hospitalId || undefined,
          patientIdNumber,
          fullName: cleanName,
          mobileNumber: cleanMobile,
          email: email?.trim() || '',
          gender: gender || 'OTHER',
          age: age || undefined,
          address: address?.trim() || null,
        },
      });
    } else {
      patient = await prisma.patient.update({
        where: { id: patient.id },
        data: {
          email: email?.trim() || patient.email,
          gender: gender || patient.gender,
          age: age !== undefined ? age : patient.age,
          address: address?.trim() || patient.address,
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
