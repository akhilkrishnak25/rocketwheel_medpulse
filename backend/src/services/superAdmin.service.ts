import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import { Response } from 'express';
import prisma from '../config/prisma';
import { AuditService } from '../utils/audit';

export class SuperAdminService {
  static async getPlatformMetrics() {
    const today = new Date().toISOString().split('T')[0];

    const [
      totalHospitals,
      totalDoctors,
      totalAppointments,
      todayAppointments,
      totalPatients,
      completedOrConfirmedApts,
      recentAuditLogs,
    ] = await Promise.all([
      prisma.hospital.count(),
      prisma.doctor.count(),
      prisma.appointment.count(),
      prisma.appointment.count({ where: { appointmentDate: today } }),
      prisma.patient.count(),
      prisma.appointment.findMany({
        where: { status: { in: ['CONFIRMED', 'COMPLETED', 'WAITING', 'IN_CONSULTATION'] } },
        select: { totalAmount: true, platformFee: true, consultationFee: true },
      }),
      prisma.auditLog.findMany({
        take: 15,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const totalRevenue = completedOrConfirmedApts.reduce((sum, a) => sum + a.totalAmount, 0);
    const platformFeeRevenue = completedOrConfirmedApts.reduce((sum, a) => sum + a.platformFee, 0);

    return {
      totalHospitals,
      totalDoctors,
      totalAppointments,
      todayAppointments,
      totalPatients,
      totalRevenue,
      platformFeeRevenue,
      recentAuditLogs,
    };
  }

  static async getAllHospitals() {
    return prisma.hospital.findMany({
      include: {
        _count: {
          select: {
            doctors: true,
            appointments: true,
            departments: true,
          },
        },
        hospitalAdmins: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  static async getHospitalById(id: string) {
    return prisma.hospital.findUnique({
      where: { id },
      include: {
        departments: {
          include: {
            _count: { select: { doctors: true, appointments: true } },
          },
        },
        doctors: {
          include: {
            department: true,
            schedules: true,
            _count: { select: { appointments: true } },
          },
        },
        hospitalAdmins: {
          include: {
            user: { select: { id: true, name: true, email: true, createdAt: true } },
          },
        },
        _count: {
          select: { appointments: true, doctors: true, departments: true },
        },
      },
    });
  }

  static async createHospital(hospitalData: any, requestingUserId?: string) {
    const slug = hospitalData.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const facilitiesJson = Array.isArray(hospitalData.facilities)
      ? JSON.stringify(hospitalData.facilities)
      : typeof hospitalData.facilities === 'string'
      ? hospitalData.facilities
      : JSON.stringify([
          '24/7 Emergency Care',
          'ICU & CCU',
          'Pharmacy',
          'Diagnostic Laboratory',
          'Radiology & MRI',
        ]);

    return prisma.$transaction(async (tx) => {
      // 1. Create Hospital
      const hospital = await tx.hospital.create({
        data: {
          name: hospitalData.name,
          slug,
          code: hospitalData.code.toUpperCase(),
          address: hospitalData.address,
          city: hospitalData.city,
          state: hospitalData.state,
          pincode: hospitalData.pincode,
          phone: hospitalData.phone,
          emergencyContact: hospitalData.emergencyContact || hospitalData.phone,
          email: hospitalData.email || `contact@${slug}.org`,
          openingHours: hospitalData.openingHours || '24/7 (Emergency & OPD)',
          about: hospitalData.about,
          facilities: facilitiesJson,
          rating: hospitalData.rating ? Number(hospitalData.rating) : 4.8,
          isEmergencyAvailable:
            hospitalData.isEmergencyAvailable !== undefined ? Boolean(hospitalData.isEmergencyAvailable) : true,
          logoUrl: hospitalData.logoUrl || null,
          imageUrl: hospitalData.imageUrl || null,
        },
      });

      // 2. Optionally provision initial Hospital Admin user
      let adminAccount = null;
      if (hospitalData.adminUser?.email && hospitalData.adminUser?.password) {
        const hashedPassword = await bcrypt.hash(hospitalData.adminUser.password, 10);
        const user = await tx.user.create({
          data: {
            name: hospitalData.adminUser.name,
            email: hospitalData.adminUser.email.toLowerCase(),
            passwordHash: hashedPassword,
            role: 'HOSPITAL_ADMIN',
          },
        });

        const hospitalAdmin = await tx.hospitalAdmin.create({
          data: {
            userId: user.id,
            hospitalId: hospital.id,
            roleTitle: 'Hospital Administrator',
          },
        });

        adminAccount = { id: user.id, email: user.email, name: user.name };
      }

      // 3. Create default primary departments
      const defaultDepartments = [
        { name: 'General Medicine', code: 'GENMED', slug: 'general-medicine', icon: 'Stethoscope' },
        { name: 'Cardiology', code: 'CARD', slug: 'cardiology', icon: 'HeartPulse' },
        { name: 'Orthopedics', code: 'ORTHO', slug: 'orthopedics', icon: 'Bone' },
        { name: 'Pediatrics', code: 'PED', slug: 'pediatrics', icon: 'Baby' },
      ];

      for (const dept of defaultDepartments) {
        await tx.department.create({
          data: {
            hospitalId: hospital.id,
            name: dept.name,
            code: dept.code,
            slug: dept.slug,
            icon: dept.icon,
            description: `Department of ${dept.name} at ${hospital.name}`,
          },
        });
      }

      await AuditService.log({
        userId: requestingUserId,
        action: 'CREATE_HOSPITAL',
        entity: 'Hospital',
        entityId: hospital.id,
        details: { name: hospital.name, code: hospital.code },
      });

      return { hospital, adminAccount };
    });
  }

  static async updateHospital(id: string, updateData: any, requestingUserId?: string) {
    const existing = await prisma.hospital.findUnique({ where: { id } });
    if (!existing) throw new Error('Hospital not found');

    const facilitiesJson = updateData.facilities
      ? Array.isArray(updateData.facilities)
        ? JSON.stringify(updateData.facilities)
        : updateData.facilities
      : undefined;

    const updated = await prisma.hospital.update({
      where: { id },
      data: {
        name: updateData.name !== undefined ? updateData.name : existing.name,
        code: updateData.code !== undefined ? updateData.code.toUpperCase() : existing.code,
        address: updateData.address !== undefined ? updateData.address : existing.address,
        city: updateData.city !== undefined ? updateData.city : existing.city,
        state: updateData.state !== undefined ? updateData.state : existing.state,
        pincode: updateData.pincode !== undefined ? updateData.pincode : existing.pincode,
        phone: updateData.phone !== undefined ? updateData.phone : existing.phone,
        emergencyContact: updateData.emergencyContact !== undefined ? updateData.emergencyContact : existing.emergencyContact,
        email: updateData.email !== undefined ? updateData.email : existing.email,
        openingHours: updateData.openingHours !== undefined ? updateData.openingHours : existing.openingHours,
        about: updateData.about !== undefined ? updateData.about : existing.about,
        facilities: facilitiesJson !== undefined ? facilitiesJson : existing.facilities,
        rating: updateData.rating !== undefined ? Number(updateData.rating) : existing.rating,
        isEmergencyAvailable:
          updateData.isEmergencyAvailable !== undefined ? Boolean(updateData.isEmergencyAvailable) : existing.isEmergencyAvailable,
        logoUrl: updateData.logoUrl !== undefined ? updateData.logoUrl : existing.logoUrl,
        imageUrl: updateData.imageUrl !== undefined ? updateData.imageUrl : existing.imageUrl,
      },
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'UPDATE_HOSPITAL',
      entity: 'Hospital',
      entityId: id,
      details: updateData,
    });

    return updated;
  }

  static async deleteHospital(id: string, requestingUserId?: string) {
    const hospital = await prisma.hospital.findUnique({
      where: { id },
      include: { _count: { select: { appointments: true } } },
    });

    if (!hospital) throw new Error('Hospital not found');

    if (hospital._count.appointments > 0) {
      throw new Error(`Cannot delete hospital with existing patient appointments (${hospital._count.appointments} appointments). You may update details instead.`);
    }

    await prisma.hospital.delete({ where: { id } });

    await AuditService.log({
      userId: requestingUserId,
      action: 'DELETE_HOSPITAL',
      entity: 'Hospital',
      entityId: id,
      details: { name: hospital.name },
    });

    return { success: true, message: 'Hospital removed successfully' };
  }

  static async getPendingHospitals() {
    return prisma.hospital.findMany({
      where: { status: 'PENDING' },
      include: {
        hospitalAdmins: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true, status: true, createdAt: true } },
          },
        },
        _count: {
          select: { doctors: true, departments: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async approveHospital(id: string, requestingUserId?: string) {
    const hospital = await prisma.hospital.findUnique({
      where: { id },
      include: { hospitalAdmins: { include: { user: true } } },
    });
    if (!hospital) throw new Error('Hospital not found');

    const updatedHospital = await prisma.$transaction(
      async (tx) => {
        const updated = await tx.hospital.update({
          where: { id },
          data: { status: 'ACTIVE' },
        });

        // Activate all hospital admins
        for (const ha of hospital.hospitalAdmins) {
          await tx.user.update({
            where: { id: ha.userId },
            data: { status: 'ACTIVE', isActive: true },
          });
        }

        return updated;
      },
      { timeout: 20000, maxWait: 15000 }
    );

    await AuditService.log({
      userId: requestingUserId,
      action: 'APPROVE_HOSPITAL',
      entity: 'Hospital',
      entityId: id,
      details: { hospitalName: hospital.name, status: 'ACTIVE' },
    });

    return updatedHospital;
  }

  static async rejectHospital(id: string, reason: string, requestingUserId?: string) {
    const hospital = await prisma.hospital.findUnique({
      where: { id },
      include: { hospitalAdmins: { include: { user: true } } },
    });
    if (!hospital) throw new Error('Hospital not found');

    const updatedHospital = await prisma.$transaction(
      async (tx) => {
        const updated = await tx.hospital.update({
          where: { id },
          data: { status: 'REJECTED' },
        });

        for (const ha of hospital.hospitalAdmins) {
          await tx.user.update({
            where: { id: ha.userId },
            data: { status: 'REJECTED', isActive: false },
          });
        }

        return updated;
      },
      { timeout: 20000, maxWait: 15000 }
    );

    await AuditService.log({
      userId: requestingUserId,
      action: 'REJECT_HOSPITAL',
      entity: 'Hospital',
      entityId: id,
      details: { hospitalName: hospital.name, reason },
    });

    return updatedHospital;
  }

  static async toggleHospitalStatus(id: string, requestingUserId?: string) {
    const hospital = await prisma.hospital.findUnique({ where: { id } });
    if (!hospital) throw new Error('Hospital not found');

    const nextStatus = hospital.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    const updated = await prisma.hospital.update({
      where: { id },
      data: { status: nextStatus },
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'TOGGLE_HOSPITAL_STATUS',
      entity: 'Hospital',
      entityId: id,
      details: { hospitalName: hospital.name, previousStatus: hospital.status, newStatus: nextStatus },
    });

    return updated;
  }


  static async createHospitalAdmin(hospitalId: string, adminData: any, requestingUserId?: string) {
    const hospital = await prisma.hospital.findUnique({ where: { id: hospitalId } });
    if (!hospital) throw new Error('Hospital not found');

    const existingUser = await prisma.user.findUnique({
      where: { email: adminData.email.toLowerCase() },
    });
    if (existingUser) {
      throw new Error('An account with this email address already exists');
    }

    const hashedPassword = await bcrypt.hash(adminData.password, 10);

    const user = await prisma.user.create({
      data: {
        name: adminData.name,
        email: adminData.email.toLowerCase(),
        passwordHash: hashedPassword,
        role: 'HOSPITAL_ADMIN',
      },
    });

    const admin = await prisma.hospitalAdmin.create({
      data: {
        userId: user.id,
        hospitalId,
        roleTitle: adminData.roleTitle || 'Hospital Administrator',
      },
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'PROVISION_HOSPITAL_ADMIN',
      entity: 'HospitalAdmin',
      entityId: admin.id,
      details: { hospitalId, email: user.email },
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roleTitle: admin.roleTitle,
      hospitalName: hospital.name,
    };
  }

  static async getAllDoctors(filters: { search?: string; hospitalId?: string; departmentId?: string } = {}) {
    const where: any = {};
    if (filters.hospitalId) where.hospitalId = filters.hospitalId;
    if (filters.departmentId) where.departmentId = filters.departmentId;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { specialization: { contains: filters.search } },
        { qualification: { contains: filters.search } },
      ];
    }

    return prisma.doctor.findMany({
      where,
      include: {
        hospital: { select: { id: true, name: true, city: true, code: true } },
        department: { select: { id: true, name: true } },
        _count: { select: { appointments: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  static async getAllAppointments(filters: { date?: string; status?: string; hospitalId?: string; limit?: number } = {}) {
    const where: any = {};
    if (filters.date) where.appointmentDate = filters.date;
    if (filters.status && filters.status !== 'ALL') where.status = filters.status;
    if (filters.hospitalId) where.hospitalId = filters.hospitalId;

    return prisma.appointment.findMany({
      where,
      include: {
        hospital: { select: { id: true, name: true, city: true } },
        doctor: { select: { id: true, name: true, specialization: true } },
        patient: { select: { fullName: true, mobileNumber: true } },
        department: { select: { name: true } },
        payment: { select: { amount: true, status: true, razorpayPaymentId: true } },
        digitalOp: { select: { opNumber: true, isVerified: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 100,
    });
  }

  static async getAllUsers() {
    return prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        hospitalAdmin: {
          select: {
            roleTitle: true,
            hospital: { select: { id: true, name: true, code: true } },
          },
        },
        doctor: {
          select: {
            id: true,
            name: true,
            specialization: true,
            hospital: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getAuditLogs(limit: number = 50) {
    return prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true, role: true } },
      },
    });
  }

  // -------------------------------------------------------------
  // LAB ACCREDITATION & APPROVAL MANAGEMENT
  // -------------------------------------------------------------
  static async getAllLabs() {
    return prisma.lab.findMany({
      include: {
        hospital: { select: { id: true, name: true, code: true } },
        technicians: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
          },
        },
        _count: {
          select: { testRequests: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async approveLab(labId: string, requestingUserId?: string) {
    const lab = await prisma.lab.findUnique({
      where: { id: labId },
      include: { technicians: true },
    });
    if (!lab) throw new Error('Laboratory not found');

    return prisma.$transaction(async (tx) => {
      const updatedLab = await tx.lab.update({
        where: { id: labId },
        data: { status: 'APPROVED' },
      });

      // Activate all technicians linked to this lab
      for (const tech of lab.technicians) {
        await tx.labTechnician.update({
          where: { id: tech.id },
          data: { status: 'ACTIVE' },
        });

        await tx.user.update({
          where: { id: tech.userId },
          data: { status: 'ACTIVE', isActive: true },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: requestingUserId,
          action: 'APPROVE_LABORATORY',
          entity: 'Lab',
          entityId: labId,
          details: JSON.stringify({ name: lab.name, type: lab.type }),
        },
      });

      return updatedLab;
    });
  }

  static async rejectLab(labId: string, requestingUserId?: string) {
    const lab = await prisma.lab.findUnique({ where: { id: labId } });
    if (!lab) throw new Error('Laboratory not found');

    return prisma.$transaction(async (tx) => {
      const updatedLab = await tx.lab.update({
        where: { id: labId },
        data: { status: 'REJECTED' },
      });

      await tx.auditLog.create({
        data: {
          userId: requestingUserId,
          action: 'REJECT_LABORATORY',
          entity: 'Lab',
          entityId: labId,
          details: JSON.stringify({ name: lab.name }),
        },
      });

      return updatedLab;
    });
  }

  // -------------------------------------------------------------
  // OP / BOOKING ANALYTICS (REAL DATABASE CALCULATIONS)
  // -------------------------------------------------------------
  static async getOpAnalytics(filters: {
    startDate?: string;
    endDate?: string;
    date?: string;
    hospitalId?: string;
    doctorId?: string;
    status?: string;
    bookingType?: string;
  }) {
    const where: any = {};

    if (filters.date) {
      where.appointmentDate = filters.date;
    } else if (filters.startDate || filters.endDate) {
      where.appointmentDate = {};
      if (filters.startDate) where.appointmentDate.gte = filters.startDate;
      if (filters.endDate) where.appointmentDate.lte = filters.endDate;
    }

    if (filters.hospitalId) where.hospitalId = filters.hospitalId;
    if (filters.doctorId) where.doctorId = filters.doctorId;
    if (filters.status) where.status = filters.status;
    if (filters.bookingType) where.bookingType = filters.bookingType;

    const appointments = await prisma.appointment.findMany({
      where,
      select: {
        id: true,
        appointmentNumber: true,
        hospitalId: true,
        doctorId: true,
        departmentId: true,
        appointmentDate: true,
        status: true,
        bookingType: true,
        totalAmount: true,
        consultationFee: true,
        hospital: { select: { id: true, name: true, code: true } },
        doctor: { select: { id: true, name: true, specialization: true } },
      },
      orderBy: { appointmentDate: 'desc' },
    });

    const totalOpCount = appointments.length;
    let onlineBookingCount = 0;
    let offlineBookingCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    let totalRevenue = 0;

    // Hierarchical analysis: Hospital -> Doctor breakdown
    const hospitalMap = new Map<
      string,
      {
        hospitalId: string;
        hospitalName: string;
        hospitalCode: string;
        totalOp: number;
        onlineOp: number;
        offlineOp: number;
        completedOp: number;
        cancelledOp: number;
        doctors: Map<
          string,
          {
            doctorId: string;
            doctorName: string;
            specialization: string;
            totalOp: number;
            onlineOp: number;
            offlineOp: number;
            completedOp: number;
            cancelledOp: number;
          }
        >;
      }
    >();

    for (const apt of appointments) {
      if (apt.bookingType === 'OFFLINE') {
        offlineBookingCount++;
      } else {
        onlineBookingCount++;
      }

      if (apt.status === 'COMPLETED') {
        completedCount++;
      } else if (apt.status === 'CANCELLED') {
        cancelledCount++;
      }

      totalRevenue += apt.totalAmount;

      // Group by hospital
      const hId = apt.hospitalId;
      if (!hospitalMap.has(hId)) {
        hospitalMap.set(hId, {
          hospitalId: hId,
          hospitalName: apt.hospital?.name || 'Unknown Hospital',
          hospitalCode: apt.hospital?.code || 'HOSP',
          totalOp: 0,
          onlineOp: 0,
          offlineOp: 0,
          completedOp: 0,
          cancelledOp: 0,
          doctors: new Map(),
        });
      }

      const hStats = hospitalMap.get(hId)!;
      hStats.totalOp++;
      if (apt.bookingType === 'OFFLINE') hStats.offlineOp++;
      else hStats.onlineOp++;
      if (apt.status === 'COMPLETED') hStats.completedOp++;
      else if (apt.status === 'CANCELLED') hStats.cancelledOp++;

      // Group by doctor
      const dId = apt.doctorId;
      if (!hStats.doctors.has(dId)) {
        hStats.doctors.set(dId, {
          doctorId: dId,
          doctorName: apt.doctor?.name || 'Unknown Doctor',
          specialization: apt.doctor?.specialization || 'General',
          totalOp: 0,
          onlineOp: 0,
          offlineOp: 0,
          completedOp: 0,
          cancelledOp: 0,
        });
      }

      const dStats = hStats.doctors.get(dId)!;
      dStats.totalOp++;
      if (apt.bookingType === 'OFFLINE') dStats.offlineOp++;
      else dStats.onlineOp++;
      if (apt.status === 'COMPLETED') dStats.completedOp++;
      else if (apt.status === 'CANCELLED') dStats.cancelledOp++;
    }

    const hierarchical = Array.from(hospitalMap.values()).map((h) => ({
      ...h,
      doctors: Array.from(h.doctors.values()),
    }));

    return {
      summary: {
        totalOpCount,
        onlineBookingCount,
        offlineBookingCount,
        completedCount,
        cancelledCount,
        totalRevenue,
      },
      hierarchical,
    };
  }

  // -------------------------------------------------------------
  // EXPORT TO EXCEL
  // -------------------------------------------------------------
  static async exportBookingsToExcel(
    filters: {
      startDate?: string;
      endDate?: string;
      date?: string;
      hospitalId?: string;
      doctorId?: string;
      status?: string;
      bookingType?: string;
    },
    res: Response
  ) {
    const where: any = {};

    if (filters.date) {
      where.appointmentDate = filters.date;
    } else if (filters.startDate || filters.endDate) {
      where.appointmentDate = {};
      if (filters.startDate) where.appointmentDate.gte = filters.startDate;
      if (filters.endDate) where.appointmentDate.lte = filters.endDate;
    }

    if (filters.hospitalId) where.hospitalId = filters.hospitalId;
    if (filters.doctorId) where.doctorId = filters.doctorId;
    if (filters.status) where.status = filters.status;
    if (filters.bookingType) where.bookingType = filters.bookingType;

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        hospital: { select: { name: true, code: true } },
        doctor: { select: { name: true, specialization: true } },
        department: { select: { name: true } },
        patient: { select: { id: true, patientIdNumber: true, fullName: true, mobileNumber: true } },
        payment: { select: { status: true, paymentMethod: true } },
      },
      orderBy: { appointmentDate: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RocketWheel MedPulse Platform';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('OP Bookings Report');

    worksheet.columns = [
      { header: 'Patient ID', key: 'patientId', width: 18 },
      { header: 'Patient Name', key: 'patientName', width: 22 },
      { header: 'Patient Mobile', key: 'patientMobile', width: 16 },
      { header: 'Hospital', key: 'hospital', width: 25 },
      { header: 'Doctor', key: 'doctor', width: 22 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Booking ID', key: 'bookingId', width: 22 },
      { header: 'Booking Date', key: 'bookingDate', width: 14 },
      { header: 'Booking Time', key: 'bookingTime', width: 16 },
      { header: 'Booking Type', key: 'bookingType', width: 15 },
      { header: 'Booking Status', key: 'bookingStatus', width: 16 },
      { header: 'Payment Status', key: 'paymentStatus', width: 16 },
      { header: 'Consultation Fee (INR)', key: 'fee', width: 22 },
    ];

    // Style the header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E40AF' }, // Navy blue
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    for (const apt of appointments) {
      worksheet.addRow({
        patientId: apt.patient.patientIdNumber || apt.patient.id.substring(0, 8),
        patientName: apt.patient.fullName,
        patientMobile: apt.patient.mobileNumber,
        hospital: apt.hospital.name,
        doctor: apt.doctor.name,
        department: apt.department.name,
        bookingId: apt.appointmentNumber,
        bookingDate: apt.appointmentDate,
        bookingTime: apt.timeSlot,
        bookingType: apt.bookingType,
        bookingStatus: apt.status,
        paymentStatus: apt.payment?.status || (apt.bookingType === 'OFFLINE' ? 'PAID_COUNTER' : 'PENDING'),
        fee: apt.consultationFee,
      });
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="MedPulse_OP_Bookings_${new Date().toISOString().split('T')[0]}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  }
}

