import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import { Response } from 'express';
import prisma from '../config/prisma';
import { AuditService } from '../utils/audit';
import { NotificationService } from './notification.service';

export class AdminService {
  static async getDashboardMetrics(hospitalId: string) {
    const today = new Date().toISOString().split('T')[0];

    const [
      todayAppointments,
      upcomingAppointments,
      waitingAppointments,
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
        where: {
          hospitalId,
          OR: [
            { appointmentDate: { gt: today }, status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] } },
            { appointmentDate: today, status: 'CONFIRMED' },
          ],
        },
      }),
      prisma.appointment.count({
        where: { hospitalId, appointmentDate: today, status: 'WAITING' },
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
        where: { hospitalId, isActive: true, status: { not: 'DELETED' } },
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
      waitingAppointments,
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
        prescription: {
          select: { id: true, followUpDate: true },
        },
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

    await NotificationService.createNotification({
      hospitalId,
      recipientType: 'DOCTOR',
      recipientId: apt.doctorId,
      title: `Appointment Status: ${data.status}`,
      message: `Appointment #${apt.appointmentNumber} for patient ${apt.patient.fullName} updated to ${data.status}.`,
      type: 'STATUS_CHANGED',
      metadata: { appointmentId, status: data.status },
    });

    return updated;
  }

  static async getDoctors(hospitalId: string) {
    return prisma.doctor.findMany({
      where: { hospitalId, status: { not: 'DELETED' } },
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
    const doctorEmail = (doctorData.email || doctorData.userAccount?.email || doctorData.doctorEmail)?.toLowerCase().trim();

    const result = await prisma.$transaction(async (tx) => {
      // Validate hospital exists
      const hospital = await tx.hospital.findUnique({ where: { id: hospitalId } });
      if (!hospital) throw new Error('Hospital not found');

      // Validate department exists
      const department = await tx.department.findUnique({ where: { id: doctorData.departmentId } });
      if (!department) throw new Error('Selected clinical department not found');

      let userId: string | null = null;
      let rawPassword: string | null = null;

      if (doctorEmail) {
        const existingUser = await tx.user.findUnique({ where: { email: doctorEmail } });
        if (existingUser) {
          if (existingUser.role !== 'DOCTOR') {
            throw new Error(`An account with email "${doctorEmail}" already exists with role ${existingUser.role}.`);
          }
          const existingDoc = await tx.doctor.findFirst({ where: { userId: existingUser.id } });
          if (existingDoc) {
            throw new Error(`Doctor with email "${doctorEmail}" is already registered under a hospital.`);
          }
          userId = existingUser.id;
        } else {
          // Provision new doctor user account with initial temporary credentials
          const initialPassword = doctorData.password || doctorData.userAccount?.password || `Doc@${Math.floor(100000 + Math.random() * 900000)}`;
          const passwordHash = await bcrypt.hash(initialPassword, 10);
          const newUser = await tx.user.create({
            data: {
              name: doctorData.name,
              email: doctorEmail,
              phone: doctorData.phone || doctorData.userAccount?.phone || null,
              passwordHash,
              role: 'DOCTOR',
              status: 'ACTIVE',
              isActive: true,
            },
          });
          userId = newUser.id;
          rawPassword = initialPassword;
        }
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
          about: doctorData.about || `Specialist in ${doctorData.specialization} providing outpatient consultations.`,
          workingDays: doctorData.workingDays || 'Mon,Tue,Wed,Thu,Fri,Sat',
          workingHoursStart: doctorData.workingHoursStart || '09:00',
          workingHoursEnd: doctorData.workingHoursEnd || '17:00',
          slotDurationMinutes: Number(doctorData.slotDurationMinutes || 30),
          breakStart: doctorData.breakStart || '13:00',
          breakEnd: doctorData.breakEnd || '14:00',
          status: 'ACTIVE',
          isActive: true,
        },
        include: { department: true, hospital: true },
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

      return {
        ...doctor,
        initialCredentials: doctorEmail && rawPassword ? {
          email: doctorEmail,
          password: rawPassword,
        } : undefined,
      };
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'ADD_DOCTOR',
      entity: 'Doctor',
      entityId: result.id,
      details: { hospitalId, doctorName: result.name, email: doctorEmail },
    });

    return result;
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

    await NotificationService.createNotification({
      hospitalId,
      recipientType: 'DOCTOR',
      recipientId: doc.userId,
      title: 'Registration Approved',
      message: `Dr. ${doc.name}, your registration has been approved. You can now access the consultation portal.`,
      type: 'REGISTRATION_APPROVED',
      metadata: { doctorId },
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

    await NotificationService.createNotification({
      hospitalId,
      recipientType: 'DOCTOR',
      recipientId: doc.userId,
      title: 'Registration Rejected',
      message: `Dr. ${doc.name}, your registration application was rejected.${reason ? ' Reason: ' + reason : ''}`,
      type: 'REGISTRATION_REJECTED',
      metadata: { doctorId, reason },
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

  static async deleteDoctor(hospitalId: string, doctorId: string, requestingUserId?: string) {
    const doctor = await prisma.doctor.findFirst({
      where: { id: doctorId, hospitalId },
      include: {
        user: true,
        _count: {
          select: {
            appointments: true,
            prescriptions: true,
          },
        },
      },
    });

    if (!doctor) {
      throw new Error('Doctor not found in this hospital');
    }

    const hasHistory = (doctor._count.appointments || 0) > 0 || (doctor._count.prescriptions || 0) > 0;

    if (hasHistory) {
      // Safe soft deletion preserving historical clinical records and foreign keys
      await prisma.$transaction(
        async (tx) => {
          await tx.doctor.update({
            where: { id: doctorId },
            data: {
              status: 'DELETED',
              isActive: false,
            },
          });

          if (doctor.userId) {
            await tx.user.update({
              where: { id: doctor.userId },
              data: {
                status: 'DEACTIVATED',
                isActive: false,
              },
            });
          }

          // Delete unbooked future appointment slots
          await tx.appointmentSlot.deleteMany({
            where: { doctorId, isBooked: false },
          });

          // Disable recurring schedules
          await tx.doctorSchedule.updateMany({
            where: { doctorId },
            data: { isAvailable: false },
          });
        },
        { timeout: 20000, maxWait: 15000 }
      );
    } else {
      // Doctor has zero consultations or appointments: clean deletion
      await prisma.$transaction(
        async (tx) => {
          await tx.doctorSchedule.deleteMany({ where: { doctorId } });
          await tx.doctorLeave.deleteMany({ where: { doctorId } });
          await tx.appointmentSlot.deleteMany({ where: { doctorId } });
          await tx.review.deleteMany({ where: { doctorId } });
          await tx.prescriptionTemplate.deleteMany({ where: { doctorId } });
          await tx.doctor.delete({ where: { id: doctorId } });

          if (doctor.userId) {
            await tx.user.delete({ where: { id: doctor.userId } }).catch(async () => {
              await tx.user.update({
                where: { id: doctor.userId! },
                data: { status: 'DEACTIVATED', isActive: false },
              });
            });
          }
        },
        { timeout: 20000, maxWait: 15000 }
      );
    }

    await AuditService.log({
      userId: requestingUserId,
      action: 'DELETE_DOCTOR',
      entity: 'Doctor',
      entityId: doctorId,
      details: {
        doctorName: doctor.name,
        hospitalId,
        softDeleted: hasHistory,
      },
    });

    return {
      success: true,
      message: `Dr. ${doctor.name} has been removed successfully.`,
      softDeleted: hasHistory,
    };
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
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      include: {
        departments: true,
        hospitalAdmins: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        },
        _count: { select: { doctors: true, appointments: true, departments: true } },
      },
    });

    if (hospital) {
      // Auto-sync: If hospital still has default Unsplash image/logo but admin has uploaded a custom avatar
      const adminWithAvatar = hospital.hospitalAdmins?.find(
        (ha: any) => ha.user?.avatarUrl && ha.user.avatarUrl.startsWith('/uploads/')
      );
      if (adminWithAvatar?.user?.avatarUrl) {
        const customUrl = adminWithAvatar.user.avatarUrl;
        const isDefaultImage = !hospital.imageUrl || hospital.imageUrl.includes('unsplash.com');
        const isDefaultLogo = !hospital.logoUrl || hospital.logoUrl.includes('unsplash.com');

        if (isDefaultImage || isDefaultLogo) {
          try {
            const updated = await prisma.hospital.update({
              where: { id: hospitalId },
              data: {
                ...(isDefaultImage ? { imageUrl: customUrl } : {}),
                ...(isDefaultLogo ? { logoUrl: customUrl } : {}),
              },
            });
            hospital.imageUrl = updated.imageUrl;
            hospital.logoUrl = updated.logoUrl;
          } catch (syncErr) {
            console.warn('Could not auto-sync hospital image from admin avatar:', syncErr);
          }
        }
      }
    }

    return hospital;
  }

  static async updateHospitalProfile(hospitalId: string, data: any, requestingUserId?: string) {
    const existing = await prisma.hospital.findUnique({ where: { id: hospitalId } });
    if (!existing) throw new Error('Hospital not found');

    const facilitiesJson = data.facilities
      ? Array.isArray(data.facilities)
        ? JSON.stringify(data.facilities)
        : data.facilities
      : undefined;

    const newLogo = data.logoUrl !== undefined ? data.logoUrl : existing.logoUrl;
    const newImage = data.imageUrl !== undefined ? data.imageUrl : existing.imageUrl;

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
        logoUrl: newLogo,
        imageUrl: newImage,
      },
    });

    // Also sync admin user's avatar if logo or image was updated
    if (requestingUserId && (data.logoUrl || data.imageUrl)) {
      try {
        await prisma.user.update({
          where: { id: requestingUserId },
          data: { avatarUrl: newLogo || newImage },
        });
      } catch (userErr) {
        console.warn('Could not sync user avatar with hospital profile update:', userErr);
      }
    }

    await AuditService.log({
      userId: requestingUserId,
      action: 'UPDATE_HOSPITAL_PROFILE',
      entity: 'Hospital',
      entityId: hospitalId,
      details: data,
    });

    return updated;
  }

  // -------------------------------------------------------------
  // DOCTOR ASSOCIATION & APPROVAL
  // -------------------------------------------------------------
  static async getPendingDoctors(hospitalId: string) {
    return prisma.doctor.findMany({
      where: { hospitalId, status: 'PENDING' },
      include: { department: true, user: { select: { email: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // -------------------------------------------------------------
  // HOSPITAL PATIENT RECORDS MANAGEMENT
  // -------------------------------------------------------------
  static async getHospitalPatients(
    hospitalId: string,
    query: { search?: string; page?: number; limit?: number }
  ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      OR: [
        { hospitalId },
        { appointments: { some: { hospitalId } } },
      ],
    };

    if (query.search) {
      where.AND = [
        {
          OR: [
            { fullName: { contains: query.search } },
            { mobileNumber: { contains: query.search } },
            { patientIdNumber: { contains: query.search } },
            { email: { contains: query.search } },
          ],
        },
      ];
    }

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        include: {
          _count: {
            select: {
              appointments: { where: { hospitalId } },
              prescriptions: { where: { hospitalId } },
              labRequests: { where: { hospitalId } },
              vitals: { where: { hospitalId } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.patient.count({ where }),
    ]);

    return {
      patients,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getPatientDetails(hospitalId: string, patientId: string) {
    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        OR: [
          { hospitalId },
          { appointments: { some: { hospitalId } } },
        ],
      },
      include: {
        appointments: {
          where: { hospitalId },
          include: {
            doctor: { select: { id: true, name: true, specialization: true } },
            department: { select: { name: true } },
            digitalOp: true,
            payment: true,
          },
          orderBy: { appointmentDate: 'desc' },
        },
        vitals: {
          where: { hospitalId },
          orderBy: { createdAt: 'desc' },
        },
        prescriptions: {
          where: { hospitalId },
          include: {
            doctor: { select: { id: true, name: true } },
            pharmacy: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        labRequests: {
          where: { hospitalId },
          include: {
            doctor: { select: { id: true, name: true } },
            lab: { select: { name: true } },
            report: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!patient) throw new Error('Patient record not found at this hospital');
    return patient;
  }

  // -------------------------------------------------------------
  // SUPPORT STAFF APPROVAL & MANAGEMENT
  // -------------------------------------------------------------
  static async getSupportStaff(hospitalId: string) {
    return prisma.supportStaff.findMany({
      where: { hospitalId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, status: true, lastLoginAt: true } },
        department: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async updateSupportStaffStatus(hospitalId: string, staffId: string, status: 'APPROVED' | 'REJECTED' | 'ACTIVE', requestingUserId?: string) {
    const staff = await prisma.supportStaff.findFirst({
      where: { id: staffId, hospitalId },
      include: { user: true },
    });
    if (!staff) throw new Error('Support staff member not found at this hospital');

    const isApproved = status === 'APPROVED' || status === 'ACTIVE';

    return prisma.$transaction(async (tx) => {
      const updated = await tx.supportStaff.update({
        where: { id: staffId },
        data: {
          status,
          approvedBy: isApproved ? requestingUserId : null,
          approvedAt: isApproved ? new Date() : null,
        },
      });

      await tx.user.update({
        where: { id: staff.userId },
        data: {
          status: isApproved ? 'ACTIVE' : 'REJECTED',
          isActive: isApproved,
        },
      });

      await NotificationService.createNotification({
        hospitalId,
        recipientType: 'STAFF',
        recipientId: staff.userId,
        title: isApproved ? 'Registration Approved' : 'Registration Rejected',
        message: `Support staff ${staff.user?.name || 'Staff'} registration has been ${isApproved ? 'approved' : 'rejected'}.`,
        type: isApproved ? 'REGISTRATION_APPROVED' : 'REGISTRATION_REJECTED',
        metadata: { staffId, status },
      });

      return updated;
    });
  }

  // -------------------------------------------------------------
  // HOSPITAL SUB-ADMIN MANAGEMENT
  // -------------------------------------------------------------
  static async createSubAdmin(
    hospitalId: string,
    data: { name: string; email: string; password: string; phone?: string | null; roleTitle?: string; permissions: string[] },
    requestingUserId?: string
  ) {
    const existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (existing) throw new Error('User with this email already exists');

    const passwordHash = await bcrypt.hash(data.password, 10);

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email.toLowerCase(),
          phone: data.phone,
          passwordHash,
          role: 'HOSPITAL_SUB_ADMIN',
          status: 'ACTIVE',
          isActive: true,
        },
      });

      const subAdmin = await tx.hospitalSubAdmin.create({
        data: {
          userId: user.id,
          hospitalId,
          roleTitle: data.roleTitle || 'Hospital Sub-Administrator',
          permissions: JSON.stringify(data.permissions || []),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: requestingUserId,
          action: 'CREATE_HOSPITAL_SUB_ADMIN',
          entity: 'HospitalSubAdmin',
          entityId: subAdmin.id,
          details: JSON.stringify({ name: data.name, email: data.email, permissions: data.permissions }),
        },
      });

      return { user, subAdmin };
    });
  }

  static async getSubAdmins(hospitalId: string) {
    const subAdmins = await prisma.hospitalSubAdmin.findMany({
      where: { hospitalId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, status: true, lastLoginAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return subAdmins.map((sa) => ({
      ...sa,
      permissionsList: JSON.parse(sa.permissions || '[]'),
    }));
  }

  static async updateSubAdminPermissions(
    hospitalId: string,
    subAdminId: string,
    data: { permissions: string[]; roleTitle?: string },
    requestingUserId?: string
  ) {
    const subAdmin = await prisma.hospitalSubAdmin.findFirst({ where: { id: subAdminId, hospitalId } });
    if (!subAdmin) throw new Error('Sub-admin not found');

    const updated = await prisma.hospitalSubAdmin.update({
      where: { id: subAdminId },
      data: {
        permissions: JSON.stringify(data.permissions),
        roleTitle: data.roleTitle || subAdmin.roleTitle,
      },
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'UPDATE_SUB_ADMIN_PERMISSIONS',
      entity: 'HospitalSubAdmin',
      entityId: subAdminId,
      details: data,
    });

    return {
      ...updated,
      permissionsList: data.permissions,
    };
  }

  static async deleteSubAdmin(hospitalId: string, subAdminId: string, requestingUserId?: string) {
    const subAdmin = await prisma.hospitalSubAdmin.findFirst({ where: { id: subAdminId, hospitalId } });
    if (!subAdmin) throw new Error('Sub-admin not found');

    await prisma.$transaction([
      prisma.hospitalSubAdmin.delete({ where: { id: subAdminId } }),
      prisma.user.delete({ where: { id: subAdmin.userId } }),
    ]);

    await AuditService.log({
      userId: requestingUserId,
      action: 'DELETE_SUB_ADMIN',
      entity: 'HospitalSubAdmin',
      entityId: subAdminId,
    });

    return { success: true };
  }

  // -------------------------------------------------------------
  // HOSPITAL ASSOCIATED LABS & VISIBILITY MANAGEMENT
  // -------------------------------------------------------------
  static async getHospitalLabs(hospitalId: string) {
    const labs = await prisma.lab.findMany({
      where: { hospitalId },
      include: {
        technicians: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true, status: true, lastLoginAt: true } },
          },
        },
        _count: {
          select: { tests: true, testRequests: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return labs.map((l) => ({
      ...l,
      testsCount: l._count.tests,
      requestsCount: l._count.testRequests,
    }));
  }

  static async updateLabVisibility(
    hospitalId: string,
    labId: string,
    visibility: 'PUBLIC' | 'PRIVATE',
    requestingUserId?: string
  ) {
    const lab = await prisma.lab.findFirst({
      where: { id: labId, hospitalId },
    });
    if (!lab) {
      throw new Error('Laboratory not found or does not belong to your hospital');
    }

    const updated = await prisma.lab.update({
      where: { id: labId },
      data: { visibility },
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'UPDATE_LAB_VISIBILITY',
      entity: 'Lab',
      entityId: labId,
      details: { previous: lab.visibility, updated: visibility, labName: lab.name },
    });

    return updated;
  }

  static async updateLab(
    hospitalId: string,
    labId: string,
    data: {
      name?: string;
      phone?: string;
      address?: string;
      city?: string;
      licenseNumber?: string;
      visibility?: 'PUBLIC' | 'PRIVATE';
      status?: string;
    },
    requestingUserId?: string
  ) {
    const lab = await prisma.lab.findFirst({
      where: { id: labId, hospitalId },
    });
    if (!lab) {
      throw new Error('Laboratory not found or does not belong to your hospital');
    }

    const updated = await prisma.lab.update({
      where: { id: labId },
      data,
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'UPDATE_HOSPITAL_LAB',
      entity: 'Lab',
      entityId: labId,
      details: data,
    });

    return updated;
  }

  static async deleteLab(
    hospitalId: string,
    labId: string,
    requestingUserId?: string
  ) {
    const lab = await prisma.lab.findFirst({
      where: { id: labId, hospitalId },
    });
    if (!lab) {
      throw new Error('Laboratory not found or does not belong to your hospital');
    }

    // Delete tests under this lab
    await prisma.labTest.deleteMany({
      where: { labId },
    });

    // Delete lab record
    await prisma.lab.delete({
      where: { id: labId },
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'DELETE_HOSPITAL_LAB',
      entity: 'Lab',
      entityId: labId,
      details: { deletedLabName: lab.name },
    });

    return { success: true, message: `Laboratory "${lab.name}" deleted successfully.` };
  }

  static async approveHospitalLab(hospitalId: string, labId: string, requestingUserId?: string) {
    const lab = await prisma.lab.findFirst({
      where: { id: labId, hospitalId },
      include: { technicians: true },
    });
    if (!lab) throw new Error('Laboratory not found or does not belong to your hospital');

    const updatedLab = await prisma.$transaction(async (tx) => {
      const updated = await tx.lab.update({
        where: { id: labId },
        data: { status: 'APPROVED' },
      });

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

      return updated;
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'APPROVE_HOSPITAL_LAB',
      entity: 'Lab',
      entityId: labId,
      details: { name: lab.name, hospitalId },
    });

    for (const tech of lab.technicians) {
      await NotificationService.createNotification({
        hospitalId,
        recipientType: 'LAB_TECHNICIAN',
        recipientId: tech.userId,
        title: 'Laboratory Approved',
        message: `Your hospital diagnostic laboratory "${lab.name}" has been approved by the hospital administration. You can now access your technician dashboard.`,
        type: 'REGISTRATION_APPROVED',
        metadata: { labId },
      });
    }

    return updatedLab;
  }

  static async rejectHospitalLab(hospitalId: string, labId: string, reason?: string, requestingUserId?: string) {
    const lab = await prisma.lab.findFirst({
      where: { id: labId, hospitalId },
      include: { technicians: true },
    });
    if (!lab) throw new Error('Laboratory not found or does not belong to your hospital');

    const updatedLab = await prisma.$transaction(async (tx) => {
      const updated = await tx.lab.update({
        where: { id: labId },
        data: { status: 'REJECTED' },
      });

      for (const tech of lab.technicians) {
        await tx.labTechnician.update({
          where: { id: tech.id },
          data: { status: 'REJECTED' },
        });

        await tx.user.update({
          where: { id: tech.userId },
          data: { status: 'REJECTED', isActive: false },
        });
      }

      return updated;
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'REJECT_HOSPITAL_LAB',
      entity: 'Lab',
      entityId: labId,
      details: { name: lab.name, hospitalId, reason },
    });

    for (const tech of lab.technicians) {
      await NotificationService.createNotification({
        hospitalId,
        recipientType: 'LAB_TECHNICIAN',
        recipientId: tech.userId,
        title: 'Laboratory Registration Rejected',
        message: `Your hospital laboratory registration application was rejected by hospital administration.${reason ? ' Reason: ' + reason : ''}`,
        type: 'REGISTRATION_REJECTED',
        metadata: { labId, reason },
      });
    }

    return updatedLab;
  }

  // -------------------------------------------------------------
  // HOSPITAL PHARMACIES & DISPENSING COUNTERS MANAGEMENT
  // -------------------------------------------------------------
  static async getHospitalPharmacies(hospitalId: string) {
    return prisma.pharmacy.findMany({
      where: { hospitalId },
      include: {
        staff: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true, status: true, lastLoginAt: true } },
          },
        },
        _count: {
          select: { prescriptions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async approvePharmacy(hospitalId: string, pharmacyId: string, requestingUserId?: string) {
    const pharmacy = await prisma.pharmacy.findFirst({
      where: { id: pharmacyId, hospitalId },
      include: { staff: true },
    });
    if (!pharmacy) throw new Error('Pharmacy not found or does not belong to your hospital');

    const updatedPharmacy = await prisma.$transaction(async (tx) => {
      const updated = await tx.pharmacy.update({
        where: { id: pharmacyId },
        data: { status: 'ACTIVE' },
      });

      for (const s of pharmacy.staff) {
        await tx.pharmacyStaff.update({
          where: { id: s.id },
          data: { status: 'ACTIVE' },
        });

        await tx.user.update({
          where: { id: s.userId },
          data: { status: 'ACTIVE', isActive: true },
        });
      }

      return updated;
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'APPROVE_PHARMACY',
      entity: 'Pharmacy',
      entityId: pharmacyId,
      details: { name: pharmacy.name, hospitalId },
    });

    for (const s of pharmacy.staff) {
      await NotificationService.createNotification({
        hospitalId,
        recipientType: 'PHARMACY_STAFF',
        recipientId: s.userId,
        title: 'Pharmacy Registration Approved',
        message: `Your pharmacy "${pharmacy.name}" has been approved by the hospital administration. You can now log in and manage prescription fulfillment.`,
        type: 'REGISTRATION_APPROVED',
        metadata: { pharmacyId },
      });
    }

    return updatedPharmacy;
  }

  static async rejectPharmacy(hospitalId: string, pharmacyId: string, reason?: string, requestingUserId?: string) {
    const pharmacy = await prisma.pharmacy.findFirst({
      where: { id: pharmacyId, hospitalId },
      include: { staff: true },
    });
    if (!pharmacy) throw new Error('Pharmacy not found or does not belong to your hospital');

    const updatedPharmacy = await prisma.$transaction(async (tx) => {
      const updated = await tx.pharmacy.update({
        where: { id: pharmacyId },
        data: { status: 'REJECTED' },
      });

      for (const s of pharmacy.staff) {
        await tx.pharmacyStaff.update({
          where: { id: s.id },
          data: { status: 'REJECTED' },
        });

        await tx.user.update({
          where: { id: s.userId },
          data: { status: 'REJECTED', isActive: false },
        });
      }

      return updated;
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'REJECT_PHARMACY',
      entity: 'Pharmacy',
      entityId: pharmacyId,
      details: { name: pharmacy.name, hospitalId, reason },
    });

    for (const s of pharmacy.staff) {
      await NotificationService.createNotification({
        hospitalId,
        recipientType: 'PHARMACY_STAFF',
        recipientId: s.userId,
        title: 'Pharmacy Registration Rejected',
        message: `Your pharmacy registration application was rejected by hospital administration.${reason ? ' Reason: ' + reason : ''}`,
        type: 'REGISTRATION_REJECTED',
        metadata: { pharmacyId, reason },
      });
    }

    return updatedPharmacy;
  }

  static async togglePharmacyStatus(hospitalId: string, pharmacyId: string, requestingUserId?: string) {
    const pharmacy = await prisma.pharmacy.findFirst({
      where: { id: pharmacyId, hospitalId },
      include: { staff: true },
    });
    if (!pharmacy) throw new Error('Pharmacy not found or does not belong to your hospital');

    const nextStatus = pharmacy.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const nextIsActive = nextStatus === 'ACTIVE';

    const updated = await prisma.$transaction(async (tx) => {
      const updated = await tx.pharmacy.update({
        where: { id: pharmacyId },
        data: { status: nextStatus },
      });

      for (const s of pharmacy.staff) {
        await tx.pharmacyStaff.update({
          where: { id: s.id },
          data: { status: nextStatus },
        });

        await tx.user.update({
          where: { id: s.userId },
          data: { status: nextStatus, isActive: nextIsActive },
        });
      }

      return updated;
    });

    await AuditService.log({
      userId: requestingUserId,
      action: 'TOGGLE_PHARMACY_STATUS',
      entity: 'Pharmacy',
      entityId: pharmacyId,
      details: { previous: pharmacy.status, current: nextStatus, name: pharmacy.name },
    });

    return updated;
  }

  static async getHospitalLabRequests(hospitalId: string, date?: string) {
    const where: any = {
      OR: [
        { hospitalId },
        { doctor: { hospitalId } },
      ],
    };

    if (date) {
      where.createdAt = {
        gte: new Date(`${date}T00:00:00.000Z`),
        lte: new Date(`${date}T23:59:59.999Z`),
      };
    }

    return prisma.labTestRequest.findMany({
      where,
      include: {
        patient: { select: { id: true, fullName: true, mobileNumber: true, patientIdNumber: true } },
        doctor: { select: { id: true, name: true, specialization: true } },
        lab: { select: { id: true, name: true, phone: true, visibility: true } },
        appointment: { select: { id: true, appointmentNumber: true, appointmentDate: true, timeSlot: true } },
        report: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // -------------------------------------------------------------
  // EXPORT ALL HOSPITAL DATA TO EXCEL WORKBOOK (.xlsx)
  // -------------------------------------------------------------
  static async exportAllHospitalDataToExcel(hospitalId: string, res: Response) {
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
    });

    if (!hospital) {
      throw new Error('Hospital record not found');
    }

    const today = new Date().toISOString().split('T')[0];

    const [
      appointments,
      doctors,
      departments,
      staff,
      patients,
      subAdmins,
    ] = await Promise.all([
      prisma.appointment.findMany({
        where: { hospitalId },
        include: {
          patient: true,
          doctor: true,
          department: true,
          payment: { select: { status: true, paymentMethod: true } },
          vitals: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: [{ appointmentDate: 'desc' }, { tokenNumber: 'asc' }],
      }),
      prisma.doctor.findMany({
        where: { hospitalId, status: { not: 'DELETED' } },
        include: {
          department: true,
          user: { select: { name: true, email: true, phone: true } },
          assignedStaff: { include: { user: { select: { name: true } } } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.department.findMany({
        where: { hospitalId },
        include: {
          _count: { select: { doctors: true, appointments: true } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.supportStaff.findMany({
        where: { hospitalId },
        include: {
          user: { select: { name: true, email: true, phone: true } },
          department: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.patient.findMany({
        where: { hospitalId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.hospitalSubAdmin.findMany({
        where: { hospitalId },
        include: {
          user: { select: { name: true, email: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RocketWheel MedPulse Platform';
    workbook.created = new Date();

    const applyHeaderStyle = (row: ExcelJS.Row, bgArgb = 'FF1E40AF') => {
      row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgArgb },
      };
      row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      row.height = 26;
    };

    // SHEET 1: HOSPITAL OVERVIEW & KPI METRICS
    const summarySheet = workbook.addWorksheet('Hospital Overview & KPIs');
    summarySheet.columns = [
      { header: 'Hospital Field / Metric', key: 'metric', width: 35 },
      { header: 'Details / Current Value', key: 'value', width: 45 },
    ];
    applyHeaderStyle(summarySheet.getRow(1), 'FF1E40AF');

    const totalRevenue = appointments
      .filter((a) => a.status === 'COMPLETED')
      .reduce((sum, a) => sum + (a.consultationFee ?? a.totalAmount ?? 0), 0);

    const summaryRows = [
      { metric: 'Hospital Name', value: hospital.name },
      { metric: 'Facility Code / Slug', value: `${hospital.code} (${hospital.slug})` },
      { metric: 'Location', value: `${hospital.city}, ${hospital.state}` },
      { metric: 'Address', value: hospital.address || 'N/A' },
      { metric: 'Hospital Contact Email', value: hospital.email || 'N/A' },
      { metric: 'Hospital Contact Phone', value: hospital.phone ? `+91 ${hospital.phone}` : 'N/A' },
      { metric: 'Registration Status', value: hospital.status },
      { metric: '--- PLATFORM TOTALS ---', value: '------------------------' },
      { metric: 'Total Appointments on Record', value: appointments.length },
      { metric: 'Today\'s OP Bookings', value: appointments.filter((a) => a.appointmentDate === today).length },
      { metric: 'Completed Consultations', value: appointments.filter((a) => a.status === 'COMPLETED').length },
      { metric: 'Waiting / In-Consultation', value: appointments.filter((a) => ['WAITING', 'IN_CONSULTATION', 'CONFIRMED'].includes(a.status)).length },
      { metric: 'Cancelled Bookings', value: appointments.filter((a) => a.status === 'CANCELLED').length },
      { metric: 'Total Consultation Revenue (INR)', value: `₹${totalRevenue.toLocaleString()}` },
      { metric: 'Registered Doctors Count', value: doctors.length },
      { metric: 'Clinical Departments', value: departments.length },
      { metric: 'Support Staff / Nurses', value: staff.length },
      { metric: 'Patient Records', value: patients.length },
      { metric: 'Sub-Administrators', value: subAdmins.length },
      { metric: 'Export Generated At', value: new Date().toLocaleString() },
    ];
    summaryRows.forEach((r) => summarySheet.addRow(r));

    // SHEET 2: ALL APPOINTMENTS
    const aptSheet = workbook.addWorksheet('Appointments & OP Bookings');
    aptSheet.columns = [
      { header: 'Booking ID', key: 'id', width: 20 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Token #', key: 'token', width: 10 },
      { header: 'Time Slot', key: 'slot', width: 16 },
      { header: 'Patient Name', key: 'patient', width: 22 },
      { header: 'Patient Mobile', key: 'mobile', width: 16 },
      { header: 'Doctor', key: 'doctor', width: 22 },
      { header: 'Department', key: 'dept', width: 20 },
      { header: 'Booking Type', key: 'type', width: 14 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Fee (₹)', key: 'fee', width: 12 },
      { header: 'Payment Status', key: 'payment', width: 16 },
    ];
    applyHeaderStyle(aptSheet.getRow(1), 'FF0D9488');

    for (const a of appointments) {
      aptSheet.addRow({
        id: a.appointmentNumber,
        date: a.appointmentDate,
        token: a.tokenNumber,
        slot: a.timeSlot,
        patient: a.patient?.fullName || 'N/A',
        mobile: a.patient?.mobileNumber || 'N/A',
        doctor: a.doctor?.name || 'N/A',
        dept: a.department?.name || 'General OPD',
        type: a.bookingType,
        status: a.status,
        fee: a.consultationFee ?? a.totalAmount ?? 0,
        payment: a.payment?.status || (a.bookingType === 'OFFLINE' ? 'PAID_COUNTER' : 'PENDING'),
      });
    }

    // SHEET 3: DOCTORS
    const docSheet = workbook.addWorksheet('Registered Doctors');
    docSheet.columns = [
      { header: 'Doctor Name', key: 'name', width: 22 },
      { header: 'Department', key: 'dept', width: 20 },
      { header: 'Specialization', key: 'spec', width: 22 },
      { header: 'Qualifications', key: 'qual', width: 20 },
      { header: 'Consultation Fee (₹)', key: 'fee', width: 20 },
      { header: 'Experience (Yrs)', key: 'exp', width: 16 },
      { header: 'Assigned Nurse', key: 'nurse', width: 22 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Phone', key: 'phone', width: 16 },
    ];
    applyHeaderStyle(docSheet.getRow(1), 'FF2563EB');

    for (const d of doctors) {
      docSheet.addRow({
        name: d.name,
        dept: d.department?.name || 'General OPD',
        spec: d.specialization,
        qual: d.qualification,
        fee: d.consultationFee,
        exp: d.experienceYears,
        nurse: d.assignedStaff?.user?.name || 'General Nursing Pool',
        status: d.status,
        email: d.user?.email || 'N/A',
        phone: d.user?.phone ? `+91 ${d.user.phone}` : 'N/A',
      });
    }

    // SHEET 4: DEPARTMENTS
    const deptSheet = workbook.addWorksheet('Clinical Departments');
    deptSheet.columns = [
      { header: 'Department Name', key: 'name', width: 25 },
      { header: 'Code', key: 'code', width: 14 },
      { header: 'Doctors Count', key: 'doctorsCount', width: 16 },
      { header: 'Appointments Total', key: 'appointmentsCount', width: 20 },
      { header: 'Description', key: 'description', width: 35 },
    ];
    applyHeaderStyle(deptSheet.getRow(1), 'FF7C3AED');

    for (const dp of departments) {
      deptSheet.addRow({
        name: dp.name,
        code: dp.code,
        doctorsCount: (dp as any)._count?.doctors || 0,
        appointmentsCount: (dp as any)._count?.appointments || 0,
        description: dp.description || 'N/A',
      });
    }

    // SHEET 5: SUPPORT STAFF
    const staffSheet = workbook.addWorksheet('Support Staff & Nurses');
    staffSheet.columns = [
      { header: 'Staff Name', key: 'name', width: 22 },
      { header: 'Role Title', key: 'role', width: 22 },
      { header: 'Department', key: 'dept', width: 20 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Phone', key: 'phone', width: 16 },
    ];
    applyHeaderStyle(staffSheet.getRow(1), 'FF059669');

    for (const s of staff) {
      staffSheet.addRow({
        name: s.user?.name || 'Staff Member',
        role: s.roleTitle || 'Triage / Screening Nurse',
        dept: s.department?.name || 'General OPD',
        status: s.status,
        email: s.user?.email || 'N/A',
        phone: s.user?.phone ? `+91 ${s.user.phone}` : 'N/A',
      });
    }

    // SHEET 6: PATIENTS
    const patientSheet = workbook.addWorksheet('Patient Records');
    patientSheet.columns = [
      { header: 'Patient UHID / ID', key: 'uhid', width: 20 },
      { header: 'Full Name', key: 'name', width: 22 },
      { header: 'Gender', key: 'gender', width: 12 },
      { header: 'Blood Group', key: 'blood', width: 14 },
      { header: 'Mobile Number', key: 'mobile', width: 16 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Address', key: 'location', width: 28 },
    ];
    applyHeaderStyle(patientSheet.getRow(1), 'FFD97706');

    for (const p of patients) {
      patientSheet.addRow({
        uhid: p.patientIdNumber || p.id.substring(0, 8),
        name: p.fullName,
        gender: p.gender || 'Unknown',
        blood: p.bloodGroup || 'N/A',
        mobile: p.mobileNumber,
        email: p.email || 'N/A',
        location: p.address || 'N/A',
      });
    }

    // Set Response Headers and Stream
    const safeHospName = (hospital.name || 'Hospital').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `MedPulse_${safeHospName}_AllData_${today}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  }

  // -------------------------------------------------------------
  // EXPORT APPOINTMENTS SEPARATELY TO EXCEL WORKBOOK (.xlsx)
  // -------------------------------------------------------------
  static async exportAppointmentsToExcel(
    hospitalId: string,
    query: { status?: string; date?: string; search?: string; doctorId?: string },
    res: Response
  ) {
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
    });
    if (!hospital) {
      throw new Error('Hospital record not found');
    }

    const where: any = { hospitalId };
    if (query.status && query.status !== 'ALL') {
      where.status = query.status;
    }
    if (query.date) {
      where.appointmentDate = query.date;
    }
    if (query.doctorId) {
      where.doctorId = query.doctorId;
    }
    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { appointmentNumber: { contains: s } },
        { patient: { fullName: { contains: s } } },
        { patient: { mobileNumber: { contains: s } } },
        { doctor: { name: { contains: s } } },
        { digitalOp: { opNumber: { contains: s } } },
      ];
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: true,
        doctor: {
          select: { name: true, specialization: true, department: { select: { name: true } } },
        },
        department: true,
        payment: true,
        digitalOp: true,
        vitals: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: [{ appointmentDate: 'desc' }, { tokenNumber: 'asc' }],
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RocketWheel MedPulse Platform';
    workbook.created = new Date();

    const applyHeaderStyle = (row: ExcelJS.Row, bgArgb = 'FF0D9488') => {
      row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgArgb },
      };
      row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      row.height = 28;
    };

    const sheet = workbook.addWorksheet('Appointments & OP Bookings');
    sheet.columns = [
      { header: 'Token #', key: 'token', width: 10 },
      { header: 'Booking Ref ID', key: 'id', width: 22 },
      { header: 'Digital OP #', key: 'opNumber', width: 22 },
      { header: 'Appointment Date', key: 'date', width: 16 },
      { header: 'Time Slot', key: 'slot', width: 18 },
      { header: 'Patient Full Name', key: 'patientName', width: 24 },
      { header: 'Patient MRN / UHID', key: 'patientMrn', width: 20 },
      { header: 'Mobile Number', key: 'mobile', width: 16 },
      { header: 'Age / Gender', key: 'ageGender', width: 16 },
      { header: 'Blood Group', key: 'blood', width: 14 },
      { header: 'Doctor Name', key: 'doctor', width: 24 },
      { header: 'Specialization / Dept', key: 'dept', width: 24 },
      { header: 'Booking Type', key: 'type', width: 14 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Consultation Fee (₹)', key: 'fee', width: 18 },
      { header: 'Total Paid (₹)', key: 'total', width: 16 },
      { header: 'Payment Status', key: 'payment', width: 18 },
      { header: 'Payment Method', key: 'payMethod', width: 16 },
      { header: 'Screening Vitals', key: 'vitals', width: 28 },
      { header: 'Cancellation Reason', key: 'cancelReason', width: 25 },
      { header: 'Clinical Notes', key: 'notes', width: 30 },
    ];
    applyHeaderStyle(sheet.getRow(1), 'FF0D9488');

    appointments.forEach((a, idx) => {
      const v = a.vitals?.[0];
      const vitalsText = v
        ? `BP: ${v.bloodPressure || 'N/A'}, Pulse: ${v.pulseRate || 'N/A'}, Temp: ${v.temperature || 'N/A'}, SpO2: ${v.spo2 ? `${v.spo2}%` : 'N/A'}`
        : 'Not recorded';

      const ageGender = [a.patient?.age ? `${a.patient.age}y` : '', a.patient?.gender || ''].filter(Boolean).join(' / ') || 'N/A';

      const row = sheet.addRow({
        token: `#${String(a.tokenNumber).padStart(2, '0')}`,
        id: a.appointmentNumber,
        opNumber: a.digitalOp?.opNumber || 'N/A',
        date: a.appointmentDate,
        slot: a.timeSlot,
        patientName: a.patient?.fullName || 'N/A',
        patientMrn: a.patient?.patientIdNumber || 'N/A',
        mobile: a.patient?.mobileNumber ? `+91 ${a.patient.mobileNumber}` : 'N/A',
        ageGender,
        blood: a.patient?.bloodGroup || 'N/A',
        doctor: a.doctor?.name ? `Dr. ${a.doctor.name}` : 'N/A',
        dept: `${a.doctor?.specialization || 'OPD'} (${a.department?.name || 'General'})`,
        type: a.bookingType || 'ONLINE',
        status: a.status,
        fee: a.consultationFee ?? 0,
        total: a.totalAmount ?? 0,
        payment: a.payment?.status || (a.bookingType === 'OFFLINE' ? 'PAID_COUNTER' : 'PAID'),
        payMethod: a.payment?.paymentMethod || (a.bookingType === 'OFFLINE' ? 'COUNTER_CASH' : 'RAZORPAY_ONLINE'),
        vitals: vitalsText,
        cancelReason: a.cancellationReason || '',
        notes: a.notes || '',
      });

      if (idx % 2 === 1) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0FDFA' },
        };
      }
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const safeHospName = (hospital.name || 'Hospital').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `MedPulse_${safeHospName}_Appointments_${todayStr}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  }

  // -------------------------------------------------------------
  // EXPORT PATIENTS SEPARATELY TO EXCEL WORKBOOK (.xlsx)
  // -------------------------------------------------------------
  static async exportPatientsToExcel(
    hospitalId: string,
    query: { search?: string },
    res: Response
  ) {
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
    });
    if (!hospital) {
      throw new Error('Hospital record not found');
    }

    const where: any = { hospitalId };
    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { fullName: { contains: s } },
        { mobileNumber: { contains: s } },
        { patientIdNumber: { contains: s } },
        { email: { contains: s } },
      ];
    }

    const patients = await prisma.patient.findMany({
      where,
      include: {
        appointments: {
          select: { id: true, appointmentDate: true, status: true },
          orderBy: { appointmentDate: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RocketWheel MedPulse Platform';
    workbook.created = new Date();

    const applyHeaderStyle = (row: ExcelJS.Row, bgArgb = 'FF1E40AF') => {
      row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgArgb },
      };
      row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      row.height = 28;
    };

    const sheet = workbook.addWorksheet('Hospital Patient Directory');
    sheet.columns = [
      { header: 'Patient MRN / UHID', key: 'mrn', width: 22 },
      { header: 'Full Legal Name', key: 'name', width: 26 },
      { header: 'Mobile Number', key: 'mobile', width: 16 },
      { header: 'Email Address', key: 'email', width: 26 },
      { header: 'Age', key: 'age', width: 10 },
      { header: 'Date of Birth', key: 'dob', width: 14 },
      { header: 'Gender', key: 'gender', width: 12 },
      { header: 'Blood Group', key: 'blood', width: 14 },
      { header: 'Address / City', key: 'address', width: 30 },
      { header: 'Emergency Contact', key: 'emergency', width: 20 },
      { header: 'Total Appointments', key: 'totalVisits', width: 18 },
      { header: 'Last Visit Date', key: 'lastVisit', width: 16 },
      { header: 'Registered On', key: 'registeredAt', width: 18 },
    ];
    applyHeaderStyle(sheet.getRow(1), 'FF1E40AF');

    patients.forEach((p, idx) => {
      const lastVisit = p.appointments?.[0]?.appointmentDate || 'N/A';
      const row = sheet.addRow({
        mrn: p.patientIdNumber || `MRN-${p.id.substring(0, 8).toUpperCase()}`,
        name: p.fullName,
        mobile: `+91 ${p.mobileNumber}`,
        email: p.email || 'N/A',
        age: p.age ?? 'N/A',
        dob: p.dateOfBirth || 'N/A',
        gender: p.gender || 'N/A',
        blood: p.bloodGroup || 'N/A',
        address: p.address || 'N/A',
        emergency: p.emergencyContact || 'N/A',
        totalVisits: p.appointments?.length || 0,
        lastVisit,
        registeredAt: new Date(p.createdAt).toLocaleDateString(),
      });

      if (idx % 2 === 1) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEFF6FF' },
        };
      }
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const safeHospName = (hospital.name || 'Hospital').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `MedPulse_${safeHospName}_Patients_${todayStr}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  }
}

