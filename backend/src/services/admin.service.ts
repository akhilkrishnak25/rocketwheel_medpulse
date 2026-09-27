import bcrypt from 'bcryptjs';
import prisma from '../config/prisma';
import { AuditService } from '../utils/audit';

export class AdminService {
  static async getDashboardMetrics(hospitalId: string) {
    const today = new Date().toISOString().split('T')[0];

    const [
      todayAppointments,
      upcomingAppointments,
      completedAppointments,
      cancelledAppointments,
      noShowAppointments,
      totalDoctors,
      totalAppointments,
      allAppointments,
      recentNotifications,
    ] = await Promise.all([
      prisma.appointment.count({
        where: { hospitalId, appointmentDate: today, status: { not: 'CANCELLED' } },
      }),
      prisma.appointment.count({
        where: { hospitalId, appointmentDate: { gt: today }, status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] } },
      }),
      prisma.appointment.count({
        where: { hospitalId, status: 'COMPLETED' },
      }),
      prisma.appointment.count({
        where: { hospitalId, status: 'CANCELLED' },
      }),
      prisma.appointment.count({
        where: { hospitalId, status: 'NO_SHOW' },
      }),
      prisma.doctor.count({
        where: { hospitalId, isActive: true },
      }),
      prisma.appointment.count({
        where: { hospitalId },
      }),
      prisma.appointment.findMany({
        where: { hospitalId, status: { in: ['CONFIRMED', 'COMPLETED', 'WAITING', 'IN_CONSULTATION'] } },
        select: { totalAmount: true, appointmentDate: true },
      }),
      prisma.notification.findMany({
        where: { hospitalId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    // Calculate revenue
    const todayRevenue = allAppointments
      .filter((a) => a.appointmentDate === today)
      .reduce((sum, a) => sum + a.totalAmount, 0);

    const totalRevenue = allAppointments.reduce((sum, a) => sum + a.totalAmount, 0);

    // Count distinct patients
    const distinctPatients = await prisma.appointment.findMany({
      where: { hospitalId },
      distinct: ['patientId'],
      select: { patientId: true },
    });

    return {
      todayAppointments,
      upcomingAppointments,
      completedAppointments,
      cancelledAppointments,
      noShowAppointments,
      todayRevenue,
      totalRevenue,
      doctorCount: totalDoctors,
      patientCount: distinctPatients.length,
      totalAppointments,
      recentNotifications,
    };
  }

  static async getAppointments(
    hospitalId: string,
    filters: {
      status?: string;
      date?: string;
      search?: string;
      doctorId?: string;
    } = {}
  ) {
    const { status, date, search, doctorId } = filters;

    const where: any = { hospitalId };

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (date) {
      where.appointmentDate = date;
    }

    if (doctorId) {
      where.doctorId = doctorId;
    }

    if (search) {
      where.OR = [
        { appointmentNumber: { contains: search } },
        { patient: { fullName: { contains: search } } },
        { patient: { mobileNumber: { contains: search } } },
        { doctor: { name: { contains: search } } },
        { digitalOp: { opNumber: { contains: search } } },
      ];
    }

    return prisma.appointment.findMany({
      where,
      include: {
        patient: true,
        doctor: {
          select: { id: true, name: true, specialization: true, department: { select: { name: true } } },
        },
        department: true,
        payment: true,
        digitalOp: true,
      },
      orderBy: [{ appointmentDate: 'desc' }, { tokenNumber: 'asc' }],
    });
  }

  static async updateAppointmentStatus(
    hospitalId: string,
    appointmentId: string,
    data: {
      status: string;
      notes?: string;
      cancellationReason?: string;
    },
    requestingUserId?: string
  ) {
    const apt = await prisma.appointment.findFirst({
      where: { id: appointmentId, hospitalId },
      include: { patient: true, doctor: true },
    });

    if (!apt) {
      throw new Error('Appointment not found for this hospital');
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: data.status,
        notes: data.notes !== undefined ? data.notes : apt.notes,
        cancellationReason: data.cancellationReason || apt.cancellationReason,
      },
      include: {
        patient: true,
        doctor: true,
        digitalOp: true,
        payment: true,
      },
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'UPDATE_APPOINTMENT_STATUS',
      entity: 'Appointment',
      entityId: appointmentId,
      details: { fromStatus: apt.status, toStatus: data.status, reason: data.cancellationReason },
    });

    return updated;
  }

  static async getDoctors(hospitalId: string) {
    return prisma.doctor.findMany({
      where: { hospitalId },
      include: {
        department: true,
        schedules: { orderBy: { dayOfWeek: 'asc' } },
        leaves: { orderBy: { startDate: 'asc' } },
        _count: {
          select: { appointments: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  static async addDoctor(hospitalId: string, doctorData: any, requestingUserId?: string) {
    return prisma.$transaction(async (tx) => {
      let userId: string | null = null;

      // Create linked user login for doctor if credentials provided
      if (doctorData.userAccount?.email && doctorData.userAccount?.password) {
        const hashedPassword = await bcrypt.hash(doctorData.userAccount.password, 10);
        const user = await tx.user.create({
          data: {
            name: doctorData.name,
            email: doctorData.userAccount.email.toLowerCase(),
            passwordHash: hashedPassword,
            role: 'DOCTOR',
          },
        });
        userId = user.id;
      }

      const doctor = await tx.doctor.create({
        data: {
          hospitalId,
          userId,
          departmentId: doctorData.departmentId,
          name: doctorData.name,
          photoUrl: doctorData.photoUrl || null,
          qualification: doctorData.qualification,
          specialization: doctorData.specialization,
          experienceYears: Number(doctorData.experienceYears || 5),
          consultationFee: Number(doctorData.consultationFee || 500),
          languages: doctorData.languages || 'English, Hindi',
          about: doctorData.about,
          workingDays: doctorData.workingDays || 'Mon,Tue,Wed,Thu,Fri,Sat',
          workingHoursStart: doctorData.workingHoursStart || '09:00',
          workingHoursEnd: doctorData.workingHoursEnd || '17:00',
          slotDurationMinutes: Number(doctorData.slotDurationMinutes || 30),
          breakStart: doctorData.breakStart || '13:00',
          breakEnd: doctorData.breakEnd || '14:00',
        },
        include: { department: true },
      });

      // Automatically initialize weekly schedules for working days (Mon-Sat: 1-6)
      for (let day = 1; day <= 6; day++) {
        await tx.doctorSchedule.create({
          data: {
            doctorId: doctor.id,
            dayOfWeek: day,
            startTime: doctor.workingHoursStart,
            endTime: doctor.workingHoursEnd,
            slotDurationMinutes: doctor.slotDurationMinutes,
            isAvailable: true,
          },
        });
      }

      await AuditService.log({
        userId: requestingUserId,
        action: 'ADD_DOCTOR',
        entity: 'Doctor',
        entityId: doctor.id,
        details: { hospitalId, doctorName: doctor.name },
      });

      return doctor;
    });
  }

  static async updateDoctor(hospitalId: string, doctorId: string, data: any, requestingUserId?: string) {
    const doc = await prisma.doctor.findFirst({
      where: { id: doctorId, hospitalId },
    });
    if (!doc) throw new Error('Doctor not found');

    const updated = await prisma.doctor.update({
      where: { id: doctorId },
      data: {
        name: data.name !== undefined ? data.name : doc.name,
        departmentId: data.departmentId !== undefined ? data.departmentId : doc.departmentId,
        specialization: data.specialization !== undefined ? data.specialization : doc.specialization,
        qualification: data.qualification !== undefined ? data.qualification : doc.qualification,
        consultationFee: data.consultationFee !== undefined ? Number(data.consultationFee) : doc.consultationFee,
        experienceYears: data.experienceYears !== undefined ? Number(data.experienceYears) : doc.experienceYears,
        languages: data.languages !== undefined ? data.languages : doc.languages,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : doc.isActive,
        workingDays: data.workingDays !== undefined ? data.workingDays : doc.workingDays,
        workingHoursStart: data.workingHoursStart !== undefined ? data.workingHoursStart : doc.workingHoursStart,
        workingHoursEnd: data.workingHoursEnd !== undefined ? data.workingHoursEnd : doc.workingHoursEnd,
        slotDurationMinutes: data.slotDurationMinutes !== undefined ? Number(data.slotDurationMinutes) : doc.slotDurationMinutes,
        breakStart: data.breakStart !== undefined ? data.breakStart : doc.breakStart,
        breakEnd: data.breakEnd !== undefined ? data.breakEnd : doc.breakEnd,
        about: data.about !== undefined ? data.about : doc.about,
        photoUrl: data.photoUrl !== undefined ? data.photoUrl : doc.photoUrl,
      },
      include: { department: true },
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'UPDATE_DOCTOR',
      entity: 'Doctor',
      entityId: doctorId,
      details: data,
    });

    return updated;
  }

  static async approveDoctor(hospitalId: string, doctorId: string, requestingUserId?: string) {
    const doc = await prisma.doctor.findFirst({
      where: { id: doctorId, hospitalId },
      include: { user: true },
    });
    if (!doc) throw new Error('Doctor not found in this hospital');

    const updated = await prisma.$transaction(
      async (tx) => {
        const u = await tx.doctor.update({
          where: { id: doctorId },
          data: { status: 'ACTIVE', isActive: true },
        });

        if (doc.userId) {
          await tx.user.update({
            where: { id: doc.userId },
            data: { status: 'ACTIVE', isActive: true },
          });
        }

        return u;
      },
      { timeout: 20000, maxWait: 15000 }
    );

    await AuditService.log({
      userId: requestingUserId,
      action: 'APPROVE_DOCTOR',
      entity: 'Doctor',
      entityId: doctorId,
      details: { doctorName: doc.name, hospitalId },
    });

    return updated;
  }

  static async rejectDoctor(hospitalId: string, doctorId: string, reason?: string, requestingUserId?: string) {
    const doc = await prisma.doctor.findFirst({
      where: { id: doctorId, hospitalId },
      include: { user: true },
    });
    if (!doc) throw new Error('Doctor not found in this hospital');

    const updated = await prisma.$transaction(
      async (tx) => {
        const u = await tx.doctor.update({
          where: { id: doctorId },
          data: { status: 'REJECTED', isActive: false },
        });

        if (doc.userId) {
          await tx.user.update({
            where: { id: doc.userId },
            data: { status: 'REJECTED', isActive: false },
          });
        }

        return u;
      },
      { timeout: 20000, maxWait: 15000 }
    );

    await AuditService.log({
      userId: requestingUserId,
      action: 'REJECT_DOCTOR',
      entity: 'Doctor',
      entityId: doctorId,
      details: { doctorName: doc.name, hospitalId, reason },
    });

    return updated;
  }

  static async toggleDoctorStatus(hospitalId: string, doctorId: string, requestingUserId?: string) {
    const doc = await prisma.doctor.findFirst({
      where: { id: doctorId, hospitalId },
      include: { user: true },
    });
    if (!doc) throw new Error('Doctor not found in this hospital');

    const nextStatus = doc.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const nextIsActive = nextStatus === 'ACTIVE';

    const updated = await prisma.$transaction(
      async (tx) => {
        const u = await tx.doctor.update({
          where: { id: doctorId },
          data: { status: nextStatus, isActive: nextIsActive },
        });

        if (doc.userId) {
          await tx.user.update({
            where: { id: doc.userId },
            data: { status: nextStatus, isActive: nextIsActive },
          });
        }

        return u;
      },
      { timeout: 20000, maxWait: 15000 }
    );

    await AuditService.log({
      userId: requestingUserId,
      action: 'TOGGLE_DOCTOR_STATUS',
      entity: 'Doctor',
      entityId: doctorId,
      details: { doctorName: doc.name, status: nextStatus },
    });

    return updated;
  }

  static async bulkImportDoctors(hospitalId: string, rawInput: string | any[], commit: boolean = false, requestingUserId?: string) {
    let rows: any[] = [];

    if (typeof rawInput === 'string') {
      const lines = rawInput.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length <= 1) {
        return { total: 0, validCount: 0, errorCount: 0, preview: [] };
      }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
      for (let i = 1; i < lines.length; i++) {
        const match = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
        const values = match.map(v => v.replace(/^"|"$/g, '').trim());
        const rowObj: any = {};
        headers.forEach((h, idx) => {
          rowObj[h] = values[idx] || '';
        });
        rows.push(rowObj);
      }
    } else if (Array.isArray(rawInput)) {
      rows = rawInput;
    }

    const departments = await prisma.department.findMany({
      where: { hospitalId },
    });

    const preview: any[] = [];
    const validDoctorsToInsert: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const errors: string[] = [];
      const rowNum = i + 1;

      const name = r.name || r.doctorname || '';
      const email = (r.email || r.doctoremail || '').toLowerCase().trim();
      const deptVal = (r.department || r.dept || r.departmentcode || '').trim().toLowerCase();
      const qualification = r.qualification || r.degree || '';
      const specialization = r.specialization || r.speciality || '';
      const expYears = Number(r.experienceyears || r.experience || 5);
      const fee = Number(r.consultationfee || r.fee || 500);
      const languages = r.languages || 'English, Hindi';
      const workingDays = r.workingdays || 'Mon,Tue,Wed,Thu,Fri,Sat';
      const workingHoursStart = r.workinghoursstart || '09:00';
      const workingHoursEnd = r.workinghoursend || '17:00';
      const about = r.about || `Experienced specialist in ${specialization || 'clinical medicine'}.`;

      if (!name || name.length < 2) errors.push('Doctor name is required (min 2 chars)');
      if (!email || !email.includes('@')) errors.push('Valid email address is required');
      if (!qualification) errors.push('Qualification is required');
      if (!specialization) errors.push('Specialization is required');
      if (isNaN(expYears) || expYears < 0) errors.push('Valid experience years required');
      if (isNaN(fee) || fee <= 0) errors.push('Valid consultation fee required');

      if (email) {
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) errors.push(`Email '${email}' is already registered in the system`);
      }

      const deptMatch = departments.find(
        d =>
          d.slug.toLowerCase() === deptVal ||
          d.code.toLowerCase() === deptVal ||
          d.name.toLowerCase() === deptVal ||
          d.name.toLowerCase().includes(deptVal)
      );

      if (!deptMatch) {
        errors.push(`Department '${deptVal || '(empty)'}' not found in hospital. Available: ${departments.map(d => d.name).join(', ')}`);
      }

      const isValid = errors.length === 0;

      const doctorData = {
        name,
        email,
        departmentId: deptMatch?.id,
        departmentName: deptMatch?.name,
        qualification,
        specialization,
        experienceYears: expYears,
        consultationFee: fee,
        languages,
        workingDays,
        workingHoursStart,
        workingHoursEnd,
        about,
      };

      preview.push({
        row: rowNum,
        isValid,
        errors,
        data: doctorData,
      });

      if (isValid) {
        validDoctorsToInsert.push(doctorData);
      }
    }

    if (commit && validDoctorsToInsert.length > 0) {
      const defaultPasswordHash = await bcrypt.hash('Password@123', 10);
      await prisma.$transaction(
        async (tx) => {
          for (const doc of validDoctorsToInsert) {
            const user = await tx.user.create({
              data: {
                name: doc.name,
                email: doc.email,
                passwordHash: defaultPasswordHash,
                role: 'DOCTOR',
                status: 'ACTIVE',
                isActive: true,
              },
            });

            const createdDoc = await tx.doctor.create({
              data: {
                hospitalId,
                userId: user.id,
                departmentId: doc.departmentId,
                name: doc.name,
                qualification: doc.qualification,
                specialization: doc.specialization,
                experienceYears: doc.experienceYears,
                consultationFee: doc.consultationFee,
                languages: doc.languages,
                workingDays: doc.workingDays,
                workingHoursStart: doc.workingHoursStart,
                workingHoursEnd: doc.workingHoursEnd,
                about: doc.about,
                status: 'ACTIVE',
                isActive: true,
              },
            });

            for (let day = 1; day <= 6; day++) {
              await tx.doctorSchedule.create({
                data: {
                  doctorId: createdDoc.id,
                  dayOfWeek: day,
                  startTime: doc.workingHoursStart,
                  endTime: doc.workingHoursEnd,
                  slotDurationMinutes: 30,
                  isAvailable: true,
                },
              });
            }
          }
        },
        { timeout: 30000, maxWait: 15000 }
      );

      await AuditService.log({
        userId: requestingUserId,
        action: 'BULK_IMPORT_DOCTORS',
        entity: 'Doctor',
        entityId: hospitalId,
        details: { importedCount: validDoctorsToInsert.length, totalRows: rows.length },
      });
    }

    return {
      total: rows.length,
      validCount: validDoctorsToInsert.length,
      errorCount: rows.length - validDoctorsToInsert.length,
      preview,
      committed: commit,
    };
  }


  // Department Management
  static async getDepartments(hospitalId: string) {
    return prisma.department.findMany({
      where: { hospitalId },
      include: {
        _count: { select: { doctors: true, appointments: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  static async addDepartment(hospitalId: string, data: { name: string; code: string; description?: string; icon?: string }, requestingUserId?: string) {
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    const existing = await prisma.department.findUnique({
      where: { hospitalId_slug: { hospitalId, slug } },
    });

    if (existing) {
      throw new Error(`Department with name "${data.name}" already exists in this hospital`);
    }

    const dept = await prisma.department.create({
      data: {
        hospitalId,
        name: data.name,
        code: data.code.toUpperCase(),
        slug,
        description: data.description || null,
        icon: data.icon || 'Activity',
      },
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'ADD_DEPARTMENT',
      entity: 'Department',
      entityId: dept.id,
      details: { hospitalId, name: dept.name, code: dept.code },
    });

    return dept;
  }

  // Doctor Schedules
  static async getDoctorSchedules(hospitalId: string, doctorId: string) {
    const doctor = await prisma.doctor.findFirst({ where: { id: doctorId, hospitalId } });
    if (!doctor) throw new Error('Doctor not found in this hospital');

    return prisma.doctorSchedule.findMany({
      where: { doctorId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  static async updateDoctorSchedules(hospitalId: string, doctorId: string, schedules: Array<{ dayOfWeek: number; startTime: string; endTime: string; slotDurationMinutes: number; isAvailable: boolean }>, requestingUserId?: string) {
    const doctor = await prisma.doctor.findFirst({ where: { id: doctorId, hospitalId } });
    if (!doctor) throw new Error('Doctor not found in this hospital');

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

  // Doctor Leaves
  static async getDoctorLeaves(hospitalId: string, doctorId: string) {
    const doctor = await prisma.doctor.findFirst({ where: { id: doctorId, hospitalId } });
    if (!doctor) throw new Error('Doctor not found in this hospital');

    return prisma.doctorLeave.findMany({
      where: { doctorId },
      orderBy: { startDate: 'desc' },
    });
  }

  static async addDoctorLeave(hospitalId: string, doctorId: string, leaveData: { startDate: string; endDate: string; reason: string }, requestingUserId?: string) {
    const doctor = await prisma.doctor.findFirst({ where: { id: doctorId, hospitalId } });
    if (!doctor) throw new Error('Doctor not found in this hospital');

    const leave = await prisma.doctorLeave.create({
      data: {
        doctorId,
        startDate: new Date(leaveData.startDate),
        endDate: new Date(leaveData.endDate),
        reason: leaveData.reason,
      },
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'ADD_DOCTOR_LEAVE',
      entity: 'DoctorLeave',
      entityId: leave.id,
      details: { doctorId, startDate: leaveData.startDate, endDate: leaveData.endDate },
    });

    return leave;
  }

  static async deleteDoctorLeave(hospitalId: string, doctorId: string, leaveId: string, requestingUserId?: string) {
    const doctor = await prisma.doctor.findFirst({ where: { id: doctorId, hospitalId } });
    if (!doctor) throw new Error('Doctor not found in this hospital');

    await prisma.doctorLeave.delete({ where: { id: leaveId } });

    await AuditService.log({
      userId: requestingUserId,
      action: 'DELETE_DOCTOR_LEAVE',
      entity: 'DoctorLeave',
      entityId: leaveId,
    });

    return { success: true, message: 'Leave removed' };
  }

  // Hospital Profile
  static async getHospitalProfile(hospitalId: string) {
    return prisma.hospital.findUnique({
      where: { id: hospitalId },
      include: {
        departments: true,
        _count: { select: { doctors: true, appointments: true, departments: true } },
      },
    });
  }

  static async updateHospitalProfile(hospitalId: string, data: any, requestingUserId?: string) {
    const existing = await prisma.hospital.findUnique({ where: { id: hospitalId } });
    if (!existing) throw new Error('Hospital not found');

    const facilitiesJson = data.facilities
      ? Array.isArray(data.facilities)
        ? JSON.stringify(data.facilities)
        : data.facilities
      : undefined;

    const updated = await prisma.hospital.update({
      where: { id: hospitalId },
      data: {
        name: data.name !== undefined ? data.name : existing.name,
        address: data.address !== undefined ? data.address : existing.address,
        city: data.city !== undefined ? data.city : existing.city,
        state: data.state !== undefined ? data.state : existing.state,
        pincode: data.pincode !== undefined ? data.pincode : existing.pincode,
        phone: data.phone !== undefined ? data.phone : existing.phone,
        emergencyContact: data.emergencyContact !== undefined ? data.emergencyContact : existing.emergencyContact,
        email: data.email !== undefined ? data.email : existing.email,
        openingHours: data.openingHours !== undefined ? data.openingHours : existing.openingHours,
        about: data.about !== undefined ? data.about : existing.about,
        facilities: facilitiesJson !== undefined ? facilitiesJson : existing.facilities,
        logoUrl: data.logoUrl !== undefined ? data.logoUrl : existing.logoUrl,
        imageUrl: data.imageUrl !== undefined ? data.imageUrl : existing.imageUrl,
      },
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'UPDATE_HOSPITAL_PROFILE',
      entity: 'Hospital',
      entityId: hospitalId,
      details: data,
    });

    return updated;
  }
}
