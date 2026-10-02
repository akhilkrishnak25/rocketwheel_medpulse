import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../config/prisma';
import { generateTokens, verifyRefreshToken } from '../utils/jwt';
import { successResponse, errorResponse } from '../utils/response';
import {
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  activateAccountSchema,
  registerHospitalSchema,
  registerDoctorSchema,
  registerLabSchema,
  registerSupportStaffSchema,
  registerPharmacySchema,
} from '../validators/schemas';

export class AuthController {
  static async login(req: Request, res: Response) {
    try {
      const validated = loginSchema.parse(req.body);
      const { email, password } = validated;

      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          hospitalAdmin: {
            include: { hospital: true },
          },
          hospitalSubAdmin: {
            include: { hospital: true },
          },
          doctor: {
            include: { hospital: true, department: true },
          },
          supportStaff: {
            include: { hospital: true, department: true },
          },
          labTechnician: {
            include: { lab: { include: { hospital: true } } },
          },
          pharmacyStaff: {
            include: { pharmacy: { include: { hospital: true } } },
          },
        },
      });

      if (!user) {
        return errorResponse(res, 'Invalid email or password credentials', 401);
      }

      // Check user password
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return errorResponse(res, 'Invalid email or password credentials', 401);
      }

      // Enforce user lifecycle status
      if (user.status === 'PENDING') {
        return errorResponse(res, 'Your account is awaiting approval from the administration.', 403);
      }
      if (user.status === 'REJECTED') {
        return errorResponse(res, 'Your registration was not approved. Please contact support.', 403);
      }
      if (user.status === 'SUSPENDED') {
        return errorResponse(res, 'Your account has been suspended. Contact your hospital administrator or support.', 403);
      }
      if (user.status === 'INVITED') {
        return errorResponse(res, 'Please complete your account activation using the link sent to your email.', 403);
      }
      if (user.status !== 'ACTIVE' || !user.isActive) {
        return errorResponse(res, 'Your account is currently inactive.', 403);
      }

      // Enforce hospital lifecycle status
      const hospital =
        user.hospitalAdmin?.hospital ||
        user.hospitalSubAdmin?.hospital ||
        user.doctor?.hospital ||
        user.supportStaff?.hospital ||
        user.labTechnician?.lab?.hospital ||
        user.pharmacyStaff?.pharmacy?.hospital;

      if (user.role !== 'SUPER_ADMIN' && hospital) {
        if (hospital.status !== 'ACTIVE') {
          return errorResponse(res, 'This hospital account is currently inactive. Contact platform support.', 403);
        }
      }

      // Enforce doctor profile lifecycle status
      if (user.role === 'DOCTOR' && user.doctor) {
        if (user.doctor.status === 'SUSPENDED') {
          return errorResponse(res, 'Your doctor profile has been suspended by the hospital administration.', 403);
        }
        if (user.doctor.status === 'PENDING') {
          return errorResponse(res, 'Your doctor account is awaiting approval from hospital administration.', 403);
        }
        if (user.doctor.status !== 'ACTIVE' || !user.doctor.isActive) {
          return errorResponse(res, 'Your doctor profile is currently inactive.', 403);
        }
      }

      // Enforce support staff status
      if (user.role === 'SUPPORT_STAFF' && user.supportStaff) {
        if (user.supportStaff.status === 'PENDING') {
          return errorResponse(res, 'Your support staff registration is pending approval by the Hospital Administrator.', 403);
        }
        if (user.supportStaff.status === 'REJECTED') {
          return errorResponse(res, 'Your support staff registration was not approved.', 403);
        }
      }

      // Enforce lab status
      if (user.role === 'LAB_TECHNICIAN' && user.labTechnician) {
        if (user.labTechnician.lab.status === 'PENDING') {
          return errorResponse(res, 'Your laboratory account is awaiting approval by the administrator.', 403);
        }
      }

      // Extract sub-admin permissions
      let subAdminPermissions: string[] | undefined;
      if (user.hospitalSubAdmin?.permissions) {
        try {
          subAdminPermissions = JSON.parse(user.hospitalSubAdmin.permissions);
        } catch {
          subAdminPermissions = [];
        }
      }

      // Record last login timestamp
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      const payload = {
        userId: user.id,
        email: user.email,
        role: user.role as any,
        hospitalId: hospital?.id,
        doctorId: user.doctor?.id,
        subAdminPermissions,
        labId: user.labTechnician?.labId,
        pharmacyId: user.pharmacyStaff?.pharmacyId,
      };

      const tokens = generateTokens(payload);

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN',
          entity: 'User',
          entityId: user.id,
          details: JSON.stringify({ role: user.role, email: user.email }),
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] as string,
        },
      });

      return successResponse(
        res,
        {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            lastLoginAt: user.lastLoginAt,
            hospital,
            doctor: user.doctor,
            hospitalSubAdmin: user.hospitalSubAdmin,
            supportStaff: user.supportStaff,
            labTechnician: user.labTechnician,
            pharmacyStaff: user.pharmacyStaff,
            subAdminPermissions,
          },
          ...tokens,
        },
        'Authentication successful'
      );
    } catch (error: any) {
      return errorResponse(res, error.message || 'Login failed', 400, error.errors);
    }
  }

  static async forgotPassword(req: Request, res: Response) {
    try {
      const validated = forgotPasswordSchema.parse(req.body);
      const { email } = validated;

      const user = await prisma.user.findUnique({
        where: { email },
      });

      let resetToken: string | undefined;
      let resetLink: string | undefined;

      if (user) {
        const token = crypto.randomBytes(32).toString('hex');
        resetToken = token;

        // Invalidate older unused reset tokens
        await prisma.accountToken.deleteMany({
          where: { email, type: 'PASSWORD_RESET' },
        });

        // Store new reset token (valid for 1 hour)
        await prisma.accountToken.create({
          data: {
            token,
            email,
            type: 'PASSWORD_RESET',
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          },
        });

        resetLink = `/staff/reset-password?token=${token}`;

        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'FORGOT_PASSWORD_REQUEST',
            entity: 'User',
            entityId: user.id,
            details: JSON.stringify({ email }),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] as string,
          },
        });
      }

      // Return standard response (with resetToken/resetLink for development testability)
      return successResponse(
        res,
        {
          message: 'If an account exists with this email, password reset instructions have been sent.',
          resetToken,
          resetLink,
        },
        'Password reset instructions sent'
      );
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to process password reset request', 400);
    }
  }

  static async verifyToken(req: Request, res: Response) {
    try {
      const token = req.query.token as string;
      const type = (req.query.type as string) || 'PASSWORD_RESET';

      if (!token) {
        return errorResponse(res, 'Token query parameter is required', 400);
      }

      const tokenRecord = await prisma.accountToken.findFirst({
        where: {
          token,
          type,
          isUsed: false,
          expiresAt: { gt: new Date() },
        },
      });

      if (!tokenRecord) {
        return errorResponse(res, 'Token is invalid or has expired. Please request a new link.', 400);
      }

      const user = await prisma.user.findUnique({
        where: { email: tokenRecord.email },
        include: {
          hospitalAdmin: { include: { hospital: true } },
          doctor: { include: { hospital: true, department: true } },
        },
      });

      return successResponse(res, {
        valid: true,
        email: tokenRecord.email,
        type: tokenRecord.type,
        user: user
          ? {
              name: user.name,
              role: user.role,
              hospital: user.hospitalAdmin?.hospital || user.doctor?.hospital,
            }
          : null,
      });
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to verify token', 400);
    }
  }

  static async resetPassword(req: Request, res: Response) {
    try {
      const validated = resetPasswordSchema.parse(req.body);
      const { token, newPassword } = validated;

      const tokenRecord = await prisma.accountToken.findFirst({
        where: {
          token,
          type: 'PASSWORD_RESET',
          isUsed: false,
          expiresAt: { gt: new Date() },
        },
      });

      if (!tokenRecord) {
        return errorResponse(res, 'Invalid or expired password reset link. Please request a new one.', 400);
      }

      const user = await prisma.user.findUnique({
        where: { email: tokenRecord.email },
      });

      if (!user) {
        return errorResponse(res, 'User associated with this token not found', 404);
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);

      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: {
            passwordHash,
            status: user.status === 'INVITED' ? 'ACTIVE' : user.status,
            isActive: true,
          },
        }),
        prisma.accountToken.update({
          where: { id: tokenRecord.id },
          data: { isUsed: true },
        }),
        prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'PASSWORD_RESET_SUCCESS',
            entity: 'User',
            entityId: user.id,
            details: JSON.stringify({ email: user.email }),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] as string,
          },
        }),
      ]);

      return successResponse(res, null, 'Password reset successfully. You can now log in with your new credentials.');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to reset password', 400);
    }
  }

  static async activateAccount(req: Request, res: Response) {
    try {
      const validated = activateAccountSchema.parse(req.body);
      const { token, password } = validated;

      const tokenRecord = await prisma.accountToken.findFirst({
        where: {
          token,
          type: 'ACTIVATION',
          isUsed: false,
          expiresAt: { gt: new Date() },
        },
      });

      if (!tokenRecord) {
        return errorResponse(res, 'Invalid or expired activation link. Contact your hospital or system administrator.', 400);
      }

      const user = await prisma.user.findUnique({
        where: { email: tokenRecord.email },
        include: { doctor: true, hospitalAdmin: true },
      });

      if (!user) {
        return errorResponse(res, 'User account not found', 404);
      }

      const passwordHash = await bcrypt.hash(password, 10);

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: {
            passwordHash,
            status: 'ACTIVE',
            isActive: true,
          },
        });

        if (user.doctor) {
          await tx.doctor.update({
            where: { id: user.doctor.id },
            data: { status: 'ACTIVE', isActive: true },
          });
        }

        await tx.accountToken.update({
          where: { id: tokenRecord.id },
          data: { isUsed: true },
        });

        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'ACCOUNT_ACTIVATED',
            entity: 'User',
            entityId: user.id,
            details: JSON.stringify({ role: user.role }),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] as string,
          },
        });
      });

      return successResponse(res, null, 'Account activated successfully! You may now sign in.');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to activate account', 400);
    }
  }

  static async registerHospital(req: Request, res: Response) {
    try {
      const validated = registerHospitalSchema.parse(req.body);
      const {
        name,
        code,
        licenseNumber,
        email,
        phone,
        emergencyContact,
        address,
        city,
        state,
        pincode,
        website,
        openingHours,
        about,
        facilities,
        adminName,
        adminEmail,
        adminPhone,
        adminPassword,
      } = validated;

      // Check if admin user email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: adminEmail },
      });
      if (existingUser) {
        return errorResponse(res, 'A user account with this administrator email already exists', 400);
      }

      // Check if hospital email already exists
      const existingHospital = await prisma.hospital.findFirst({
        where: { OR: [{ email }] },
      });
      if (existingHospital) {
        return errorResponse(res, 'A hospital with this official email is already registered or pending review', 400);
      }

      // Generate unique slug & code
      let baseSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      let slug = baseSlug;
      let counter = 1;
      while (await prisma.hospital.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter++}`;
      }

      let finalCode = code;
      if (finalCode) {
        const existingCode = await prisma.hospital.findUnique({ where: { code: finalCode } });
        if (existingCode) {
          return errorResponse(res, `A hospital with code '${finalCode}' already exists. Please choose a different code.`, 400);
        }
      } else {
        const baseCode = `${name.replace(/[^A-Za-z]/g, '').substring(0, 4).toUpperCase()}-${city
          .replace(/[^A-Za-z]/g, '')
          .substring(0, 3)
          .toUpperCase()}`;
        finalCode = baseCode;
        let codeCounter = 1;
        while (await prisma.hospital.findUnique({ where: { code: finalCode } })) {
          finalCode = `${baseCode}-${codeCounter++}`;
        }
      }

      const facilitiesJson = Array.isArray(facilities)
        ? JSON.stringify(facilities)
        : typeof facilities === 'string'
        ? facilities
        : JSON.stringify(['24/7 Emergency Care', 'In-house Pharmacy', 'Pathology Lab']);

      const defaultPassword = adminPassword || 'Password@123';
      const passwordHash = await bcrypt.hash(defaultPassword, 10);
      const userStatus = adminPassword ? 'PENDING' : 'INVITED';

      const result = await prisma.$transaction(async (tx) => {
        // 1. Create Hospital with PENDING status
        const hospital = await tx.hospital.create({
          data: {
            name,
            slug,
            code: finalCode,
            status: 'PENDING',
            website: website || null,
            logoUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=150&auto=format&fit=crop&q=80',
            imageUrl: 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=1200&auto=format&fit=crop&q=80',
            address,
            city,
            state,
            pincode,
            phone,
            email,
            emergencyContact: emergencyContact || phone,
            openingHours: openingHours || '24/7 (Emergency), OPD: 09:00 AM - 08:00 PM',
            about: licenseNumber ? `${about} | License/Reg No: ${licenseNumber}` : about,
            facilities: facilitiesJson,
            rating: 4.5,
            isEmergencyAvailable: true,
          },
        });

        // 2. Create Administrator User with PENDING status
        const user = await tx.user.create({
          data: {
            name: adminName,
            email: adminEmail,
            phone: adminPhone,
            passwordHash,
            role: 'HOSPITAL_ADMIN',
            status: userStatus,
            isActive: false, // Inactive until approved
          },
        });

        // 3. Link HospitalAdmin relation
        await tx.hospitalAdmin.create({
          data: {
            userId: user.id,
            hospitalId: hospital.id,
            roleTitle: 'Hospital Administrator',
          },
        });

        // 4. Generate Activation Token
        const activationToken = crypto.randomBytes(32).toString('hex');
        await tx.accountToken.create({
          data: {
            token: activationToken,
            email: adminEmail,
            type: 'ACTIVATION',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        });

        // 5. Default Department (General Medicine)
        await tx.department.create({
          data: {
            hospitalId: hospital.id,
            name: 'General Medicine',
            slug: 'general-medicine',
            code: `${finalCode.split('-')[0]}-GM`,
            description: 'Comprehensive outpatient and inpatient adult general medical care.',
            icon: 'Stethoscope',
          },
        });

        // 6. Audit log
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'HOSPITAL_REGISTRATION_SUBMITTED',
            entity: 'Hospital',
            entityId: hospital.id,
            details: JSON.stringify({ hospitalName: name, adminEmail, city }),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] as string,
          },
        });

        return { hospital, user, activationToken };
      });

      return successResponse(
        res,
        {
          hospitalId: result.hospital.id,
          hospitalName: result.hospital.name,
          adminEmail: result.user.email,
          status: 'PENDING',
          activationToken: result.activationToken,
          activationLink: `/staff/activate?token=${result.activationToken}`,
        },
        'Hospital registration submitted successfully! Our team will review your application within 24-48 hours.',
        201
      );
    } catch (error: any) {
      return errorResponse(res, error.message || 'Hospital registration failed', 400, error.errors);
    }
  }

  static async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken } = refreshTokenSchema.parse(req.body);
      const decoded = verifyRefreshToken(refreshToken);

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { hospitalAdmin: true, doctor: true },
      });

      if (!user || !user.isActive || user.status !== 'ACTIVE') {
        return errorResponse(res, 'Invalid refresh token or inactive account', 401);
      }

      const payload = {
        userId: user.id,
        email: user.email,
        role: user.role as any,
        hospitalId: user.hospitalAdmin?.hospitalId || user.doctor?.hospitalId,
        doctorId: user.doctor?.id,
      };

      const tokens = generateTokens(payload);

      return successResponse(res, tokens, 'Token refreshed successfully');
    } catch (error: any) {
      return errorResponse(res, 'Session expired or refresh token invalid', 401);
    }
  }

  static async me(req: Request, res: Response) {
    try {
      if (!req.user) {
        return errorResponse(res, 'Unauthorized', 401);
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: {
          hospitalAdmin: {
            include: { hospital: true },
          },
          hospitalSubAdmin: {
            include: { hospital: true },
          },
          doctor: {
            include: { hospital: true, department: true },
          },
          supportStaff: {
            include: { hospital: true, department: true },
          },
          labTechnician: {
            include: { lab: { include: { hospital: true } } },
          },
          pharmacyStaff: {
            include: { pharmacy: { include: { hospital: true } } },
          },
        },
      });

      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      const hospital =
        user.hospitalAdmin?.hospital ||
        user.hospitalSubAdmin?.hospital ||
        user.doctor?.hospital ||
        user.supportStaff?.hospital ||
        user.labTechnician?.lab?.hospital ||
        user.pharmacyStaff?.pharmacy?.hospital;

      let subAdminPermissions: string[] | undefined;
      if (user.hospitalSubAdmin?.permissions) {
        try {
          subAdminPermissions = JSON.parse(user.hospitalSubAdmin.permissions);
        } catch {
          subAdminPermissions = [];
        }
      }

      return successResponse(res, {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        lastLoginAt: user.lastLoginAt,
        hospital,
        doctor: user.doctor,
        hospitalSubAdmin: user.hospitalSubAdmin,
        supportStaff: user.supportStaff,
        labTechnician: user.labTechnician,
        pharmacyStaff: user.pharmacyStaff,
        subAdminPermissions,
      });
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch user profile', 500);
    }
  }

  static async registerDoctor(req: Request, res: Response) {
    try {
      const validated = registerDoctorSchema.parse(req.body);
      const {
        name,
        email,
        password,
        phone,
        hospitalId,
        departmentId,
        qualification,
        specialization,
        experienceYears,
        consultationFee,
        languages,
        about,
        workingDays,
        workingHoursStart,
        workingHoursEnd,
        slotDurationMinutes,
      } = validated;

      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });
      if (existingUser) {
        return errorResponse(res, 'An account with this email address already exists', 400);
      }

      const hospital = await prisma.hospital.findUnique({ where: { id: hospitalId } });
      if (!hospital) return errorResponse(res, 'Selected hospital does not exist', 404);

      const department = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!department) return errorResponse(res, 'Selected department does not exist', 404);

      const passwordHash = await bcrypt.hash(password, 10);

      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name,
            email: email.toLowerCase(),
            phone,
            passwordHash,
            role: 'DOCTOR',
            status: 'PENDING',
            isActive: false, // Awaiting hospital admin approval
          },
        });

        const doctor = await tx.doctor.create({
          data: {
            userId: user.id,
            hospitalId,
            departmentId,
            name,
            qualification,
            specialization,
            experienceYears,
            consultationFee,
            languages,
            about,
            workingDays,
            workingHoursStart,
            workingHoursEnd,
            slotDurationMinutes,
            status: 'PENDING',
            isActive: false,
          },
        });

        // Initialize default schedules
        for (let day = 1; day <= 6; day++) {
          await tx.doctorSchedule.create({
            data: {
              doctorId: doctor.id,
              dayOfWeek: day,
              startTime: workingHoursStart,
              endTime: workingHoursEnd,
              slotDurationMinutes,
              isAvailable: true,
            },
          });
        }

        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'DOCTOR_SELF_REGISTRATION',
            entity: 'Doctor',
            entityId: doctor.id,
            details: JSON.stringify({ doctorName: name, email, hospitalId }),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] as string,
          },
        });

        return { user, doctor };
      });

      return successResponse(
        res,
        {
          id: result.doctor.id,
          name: result.doctor.name,
          email: result.user.email,
          status: 'PENDING',
          message: 'Doctor account registered successfully! Awaiting approval from Hospital Administration.',
        },
        'Doctor account registered successfully! Awaiting approval from Hospital Administration.',
        201
      );
    } catch (error: any) {
      return errorResponse(res, error.message || 'Doctor registration failed', 400, error.errors);
    }
  }

  static async registerLab(req: Request, res: Response) {
    try {
      const validated = registerLabSchema.parse(req.body);
      const {
        name,
        type,
        hospitalId,
        email,
        phone,
        address,
        city,
        licenseNumber,
        adminName,
        adminPassword,
      } = validated;

      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });
      if (existingUser) {
        return errorResponse(res, 'An account with this email address already exists', 400);
      }

      const passwordHash = await bcrypt.hash(adminPassword, 10);

      const result = await prisma.$transaction(async (tx) => {
        const lab = await tx.lab.create({
          data: {
            name,
            type,
            hospitalId: hospitalId || null,
            email: email.toLowerCase(),
            phone,
            address,
            city,
            licenseNumber,
            status: 'PENDING', // Awaiting super admin (or hospital admin) approval
          },
        });

        const user = await tx.user.create({
          data: {
            name: adminName,
            email: email.toLowerCase(),
            phone,
            passwordHash,
            role: 'LAB_TECHNICIAN',
            status: 'PENDING',
            isActive: false,
          },
        });

        const technician = await tx.labTechnician.create({
          data: {
            userId: user.id,
            labId: lab.id,
            hospitalId: hospitalId || null,
            roleTitle: 'Chief Lab Technician',
            status: 'PENDING',
          },
        });

        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'LAB_REGISTRATION',
            entity: 'Lab',
            entityId: lab.id,
            details: JSON.stringify({ labName: name, type, email }),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] as string,
          },
        });

        return { lab, user, technician };
      });

      return successResponse(
        res,
        {
          labId: result.lab.id,
          labName: result.lab.name,
          status: 'PENDING',
          message: 'Laboratory registered successfully! Registration is pending administrator approval.',
        },
        'Laboratory registered successfully! Registration is pending administrator approval.',
        201
      );
    } catch (error: any) {
      return errorResponse(res, error.message || 'Lab registration failed', 400, error.errors);
    }
  }

  static async registerSupportStaff(req: Request, res: Response) {
    try {
      const validated = registerSupportStaffSchema.parse(req.body);
      const { name, email, password, phone, hospitalId, departmentId, department, roleTitle } = validated as any;

      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });
      if (existingUser) {
        return errorResponse(res, 'An account with this email address already exists', 400);
      }

      const hospital = await prisma.hospital.findUnique({ where: { id: hospitalId } });
      if (!hospital) return errorResponse(res, 'Selected hospital not found', 404);

      const passwordHash = await bcrypt.hash(password, 10);

      const resolvedRoleTitle = department && !roleTitle.includes(department)
        ? `${roleTitle} (${department})`
        : roleTitle;

      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name,
            email: email.toLowerCase(),
            phone,
            passwordHash,
            role: 'SUPPORT_STAFF',
            status: 'PENDING',
            isActive: false,
          },
        });

        const staff = await tx.supportStaff.create({
          data: {
            userId: user.id,
            hospitalId,
            departmentId: departmentId || null,
            roleTitle: resolvedRoleTitle,
            status: 'PENDING',
          },
        });

        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'SUPPORT_STAFF_REGISTRATION',
            entity: 'SupportStaff',
            entityId: staff.id,
            details: JSON.stringify({ name, email, hospitalId }),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] as string,
          },
        });

        return { user, staff };
      });

      return successResponse(
        res,
        {
          id: result.staff.id,
          name: result.user.name,
          email: result.user.email,
          status: 'PENDING',
          message: 'Support staff registration submitted successfully! Awaiting Hospital Administrator approval.',
        },
        'Support staff registration submitted successfully! Awaiting Hospital Administrator approval.',
        201
      );
    } catch (error: any) {
      return errorResponse(res, error.message || 'Support staff registration failed', 400, error.errors);
    }
  }

  static async registerPharmacy(req: Request, res: Response) {
    try {
      const validated = registerPharmacySchema.parse(req.body);
      const { name, hospitalId, email, phone, address, licenseNumber, staffName, staffPassword } = validated;

      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });
      if (existingUser) {
        return errorResponse(res, 'An account with this email address already exists', 400);
      }

      const passwordHash = await bcrypt.hash(staffPassword, 10);

      const result = await prisma.$transaction(async (tx) => {
        const pharmacy = await tx.pharmacy.create({
          data: {
            name,
            hospitalId: hospitalId || null,
            email: email.toLowerCase(),
            phone,
            address,
            licenseNumber,
            status: 'ACTIVE',
          },
        });

        const user = await tx.user.create({
          data: {
            name: staffName,
            email: email.toLowerCase(),
            phone,
            passwordHash,
            role: 'PHARMACY_STAFF',
            status: 'ACTIVE',
            isActive: true,
          },
        });

        const staff = await tx.pharmacyStaff.create({
          data: {
            userId: user.id,
            pharmacyId: pharmacy.id,
            hospitalId: hospitalId || null,
            roleTitle: 'Chief Pharmacist',
            status: 'ACTIVE',
          },
        });

        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'PHARMACY_REGISTRATION',
            entity: 'Pharmacy',
            entityId: pharmacy.id,
            details: JSON.stringify({ name, email, hospitalId }),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] as string,
          },
        });

        return { pharmacy, user, staff };
      });

      return successResponse(
        res,
        {
          pharmacyId: result.pharmacy.id,
          name: result.pharmacy.name,
          status: 'ACTIVE',
          message: 'Pharmacy registered successfully! You can now log in.',
        },
        'Pharmacy registered successfully!',
        201
      );
    } catch (error: any) {
      return errorResponse(res, error.message || 'Pharmacy registration failed', 400, error.errors);
    }
  }
}

