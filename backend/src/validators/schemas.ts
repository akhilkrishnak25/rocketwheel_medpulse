import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address format'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

export const activateAccountSchema = z.object({
  token: z.string().min(1, 'Activation token is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerHospitalSchema = z.object({
  name: z.string().min(3, 'Hospital name must be at least 3 characters'),
  code: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim().length >= 2 ? val.trim().toUpperCase() : undefined)),
  licenseNumber: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : null)),
  email: z.string().email('Valid hospital email is required'),
  phone: z.string().min(7, 'Hospital phone is required'),
  emergencyContact: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : null)),
  address: z.string().min(5, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  pincode: z.string().regex(/^\d{6}$/, 'Please enter a valid 6-digit Indian PIN code'),
  website: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : null)),
  openingHours: z.string().optional().default('24/7 (Emergency), OPD: 09:00 AM - 07:00 PM'),
  about: z.string().min(10, 'About / overview is required (min 10 characters)'),
  facilities: z.union([z.array(z.string()), z.string()]).optional().default([]),
  adminName: z.string().min(2, 'Administrator full name is required'),
  adminEmail: z.string().email('Valid administrator official email required'),
  adminPhone: z.string().min(7, 'Administrator phone is required'),
  adminPassword: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim().length >= 6 ? val : undefined)),
});

export const bulkImportDoctorRowSchema = z.object({
  name: z.string().min(2, 'Doctor name is required'),
  email: z.string().email('Valid email is required'),
  department: z.string().min(2, 'Department name or code is required'),
  qualification: z.string().min(2, 'Qualification is required'),
  specialization: z.string().min(2, 'Specialization is required'),
  experienceYears: z.coerce.number().int().min(0).default(5),
  consultationFee: z.coerce.number().min(0).default(500),
  languages: z.string().default('English, Hindi'),
  workingDays: z.string().default('Mon,Tue,Wed,Thu,Fri,Sat'),
  workingHoursStart: z.string().regex(/^\d{2}:\d{2}$/).default('09:00'),
  workingHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).default('17:00'),
  about: z.string().optional().default('Experienced medical specialist providing comprehensive clinical care.'),
});


export const createAppointmentSchema = z.object({
  hospitalId: z.string().min(1, 'Invalid hospital ID'),
  doctorId: z.string().min(1, 'Invalid doctor ID'),
  departmentId: z.string().min(1, 'Invalid department ID'),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
  timeSlot: z.string().min(1, 'Time slot is required'),
  // Guest Patient info (no login required!)
  patient: z.object({
    fullName: z.string().min(2, 'Full Name is required (minimum 2 characters)'),
    mobileNumber: z.string().regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number'),
    email: z.string().email('Invalid email address'),
    dateOfBirth: z.string().optional().nullable(),
    gender: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    bloodGroup: z.string().optional().nullable(),
    emergencyContact: z.string().optional().nullable(),
  }),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional().nullable(),
});

export const verifyPaymentSchema = z.object({
  appointmentId: z.string().uuid('Invalid appointment ID'),
  razorpayOrderId: z.string().min(1, 'Razorpay order ID required'),
  razorpayPaymentId: z.string().min(1, 'Razorpay payment ID required'),
  razorpaySignature: z.string().min(1, 'Razorpay signature required'),
});

export const sendOtpSchema = z.object({
  appointmentNumberOrId: z.string().min(3, 'Appointment ID or number required'),
  mobileNumber: z.string().regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number'),
});

export const verifyOtpSchema = z.object({
  appointmentNumberOrId: z.string().min(3, 'Appointment ID or number required'),
  mobileNumber: z.string().regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number'),
  otpCode: z.string().length(6, 'OTP must be 6 digits'),
});

export const updateAppointmentStatusSchema = z.object({
  status: z.enum([
    'PENDING_PAYMENT',
    'CONFIRMED',
    'WAITING',
    'IN_CONSULTATION',
    'COMPLETED',
    'CANCELLED',
    'NO_SHOW',
  ]),
  notes: z.string().optional(),
  cancellationReason: z.string().optional(),
});

export const cancelAppointmentSchema = z.object({
  cancellationReason: z.string().min(3, 'Cancellation reason is required (min 3 characters)'),
});

export const createHospitalSchema = z.object({
  name: z.string().min(3, 'Hospital name must be at least 3 characters'),
  code: z.string().min(2, 'Hospital code must be at least 2 characters').toUpperCase(),
  address: z.string().min(5, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  pincode: z.string().regex(/^\d{6}$/, 'Please enter a valid 6-digit Indian PIN code'),
  phone: z.string().min(7, 'Phone number is required'),
  emergencyContact: z.string().optional().nullable(),
  email: z.string().email('Valid hospital contact email required').optional().nullable().or(z.literal('')),
  openingHours: z.string().optional().nullable(),
  about: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length >= 10 ? val.trim() : 'Advanced multi-speciality tertiary care medical center.')),
  facilities: z.union([z.array(z.string()), z.string()]).optional().default([]),
  rating: z.coerce.number().min(1).max(5).optional().default(4.8),
  isEmergencyAvailable: z.boolean().optional().default(true),
  minConsultationFee: z.coerce.number().min(0).optional().default(500),
  logoUrl: z.string().url().optional().nullable().or(z.literal('')),
  imageUrl: z.string().url().optional().nullable().or(z.literal('')),
  adminUser: z
    .object({
      name: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(6),
    })
    .optional(),
});

export const updateHospitalSchema = z.object({
  name: z.string().min(3).optional(),
  code: z.string().min(2).toUpperCase().optional(),
  address: z.string().min(5).optional(),
  city: z.string().min(2).optional(),
  state: z.string().min(2).optional(),
  pincode: z.string().regex(/^\d{6}$/).optional(),
  phone: z.string().min(7).optional(),
  emergencyContact: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  openingHours: z.string().optional().nullable(),
  about: z.string().optional(),
  facilities: z.union([z.array(z.string()), z.string()]).optional(),
  rating: z.coerce.number().min(1).max(5).optional(),
  isEmergencyAvailable: z.boolean().optional(),
  minConsultationFee: z.coerce.number().min(0).optional(),
  logoUrl: z.string().optional().nullable().or(z.literal('')),
  imageUrl: z.string().optional().nullable().or(z.literal('')),
});

export const createHospitalAdminSchema = z.object({
  name: z.string().min(2, 'Admin name must be at least 2 characters'),
  email: z.string().email('Valid email address required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  roleTitle: z.string().optional().default('Hospital Administrator'),
});

export const createDepartmentSchema = z.object({
  name: z.string().min(2, 'Department name is required'),
  code: z.string().min(2, 'Department code is required').toUpperCase(),
  description: z.string().optional().nullable(),
  icon: z.string().optional().default('Activity'),
});

export const createDoctorSchema = z.object({
  departmentId: z.string().min(1, 'Valid department ID required'),
  name: z.string().min(2, 'Doctor name is required'),
  photoUrl: z.string().optional().nullable().or(z.literal('')),
  qualification: z.string().min(2, 'Qualification is required (e.g. MBBS, MD)'),
  specialization: z.string().min(2, 'Specialization is required'),
  experienceYears: z.coerce.number().int().min(0).default(5),
  consultationFee: z.coerce.number().min(0).default(500),
  languages: z.string().default('English, Hindi'),
  about: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : 'Experienced medical specialist providing comprehensive clinical care.')),
  workingDays: z.string().default('Mon,Tue,Wed,Thu,Fri,Sat'),
  workingHoursStart: z.string().regex(/^\d{2}:\d{2}$/).default('09:00'),
  workingHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).default('17:00'),
  slotDurationMinutes: z.coerce.number().int().min(10).max(120).default(30),
  breakStart: z.string().optional().nullable().default('13:00'),
  breakEnd: z.string().optional().nullable().default('14:00'),
  userAccount: z
    .object({
      email: z.string().email(),
      password: z.string().min(6),
    })
    .optional(),
});

export const updateDoctorSchema = z.object({
  departmentId: z.string().min(1).optional(),
  name: z.string().min(2).optional(),
  photoUrl: z.string().optional().nullable().or(z.literal('')),
  qualification: z.string().optional(),
  specialization: z.string().optional(),
  experienceYears: z.coerce.number().int().min(0).optional(),
  consultationFee: z.coerce.number().min(0).optional(),
  languages: z.string().optional(),
  about: z.string().optional(),
  workingDays: z.string().optional(),
  workingHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  workingHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  slotDurationMinutes: z.coerce.number().int().min(10).max(120).optional(),
  breakStart: z.string().optional().nullable(),
  breakEnd: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const doctorLeaveSchema = z.object({
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  reason: z.string().min(2, 'Reason for leave is required'),
});

export const doctorScheduleUpdateSchema = z.object({
  schedules: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      slotDurationMinutes: z.coerce.number().int().min(10).max(120).default(30),
      isAvailable: z.boolean().default(true),
    })
  ),
});

export const completeConsultationSchema = z.object({
  diagnosis: z.string().min(2, 'Diagnosis is required'),
  medicines: z
    .array(
      z.object({
        name: z.string().min(1, 'Medicine name is required'),
        dosage: z.string().min(1, 'Dosage is required'),
        frequency: z.string().min(1, 'Frequency is required'),
        duration: z.string().min(1, 'Duration is required'),
        instructions: z.string().optional(),
      })
    )
    .optional()
    .default([]),
  instructions: z.string().optional(),
  followUpDate: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : null)),
  symptoms: z.string().optional(),
  vitals: z
    .object({
      bp: z.string().optional(),
      pulse: z.string().optional(),
      temperature: z.string().optional(),
      weight: z.string().optional(),
      spo2: z.string().optional(),
    })
    .optional(),
  clinicalNotes: z.string().optional(),
  sendToPharmacy: z.boolean().optional().default(false),
  pharmacyId: z.string().optional().nullable(),
});

export const registerDoctorSchema = z.object({
  name: z.string().min(2, 'Full name is required'),
  email: z.string().email('Valid professional email required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().min(7, 'Phone number is required'),
  hospitalId: z.string().min(1, 'Associated hospital is required'),
  departmentId: z.string().min(1, 'Medical department is required'),
  qualification: z.string().min(2, 'Medical qualifications (e.g. MBBS, MD) required'),
  specialization: z.string().min(2, 'Specialization is required'),
  experienceYears: z.coerce.number().int().min(0).default(5),
  consultationFee: z.coerce.number().min(0).default(500),
  languages: z.string().optional().default('English, Hindi'),
  about: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : 'Experienced medical specialist providing comprehensive clinical care.')),
  workingDays: z.string().optional().default('Mon,Tue,Wed,Thu,Fri,Sat'),
  workingHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional().default('09:00'),
  workingHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional().default('17:00'),
  slotDurationMinutes: z.coerce.number().int().min(10).max(120).optional().default(30),
});

export const registerLabSchema = z
  .object({
    name: z.string().min(3, 'Laboratory name required'),
    type: z.preprocess(
      (val) => (val === 'HOSPITAL_ASSOCIATED' ? 'HOSPITAL' : val),
      z.enum(['HOSPITAL', 'INDEPENDENT']).default('INDEPENDENT')
    ),
    hospitalId: z.string().optional().nullable(),
    email: z.string().email('Valid laboratory email required'),
    phone: z.string().min(7, 'Contact phone required'),
    address: z.string().min(5, 'Laboratory facility address required'),
    city: z.string().min(2, 'City is required'),
    state: z.string().optional().nullable(),
    pincode: z.string().optional().nullable(),
    licenseNumber: z.string().min(3, 'Accreditation / Clinical license number required'),
    adminName: z.string().optional(),
    contactPerson: z.string().optional(),
    adminPassword: z.string().optional(),
    password: z.string().optional(),
  })
  .transform((data) => ({
    ...data,
    adminName: data.adminName || data.contactPerson || '',
    adminPassword: data.adminPassword || data.password || '',
  }))
  .refine((data) => data.adminName.trim().length >= 2, {
    message: 'Lab director / contact person name required (min 2 characters)',
    path: ['adminName'],
  })
  .refine((data) => data.adminPassword.length >= 6, {
    message: 'Portal login password must be at least 6 characters',
    path: ['adminPassword'],
  });

export const registerSupportStaffSchema = z.object({
  name: z.string().min(2, 'Full name required'),
  email: z.string().email('Valid staff email required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().min(7, 'Contact phone required'),
  hospitalId: z.string().min(1, 'Hospital affiliation required'),
  departmentId: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  roleTitle: z.string().optional().default('Support Staff / Nurse'),
});

export const registerPharmacySchema = z
  .object({
    name: z.string().min(3, 'Pharmacy name required'),
    hospitalId: z.string().optional().nullable(),
    email: z.string().email('Valid pharmacy email required'),
    phone: z.string().min(7, 'Contact phone required'),
    address: z.string().optional().nullable(),
    licenseNumber: z.string().min(3, 'Drug license number required'),
    staffName: z.string().optional(),
    contactPerson: z.string().optional(),
    staffPassword: z.string().optional(),
    password: z.string().optional(),
  })
  .transform((data) => ({
    ...data,
    staffName: data.staffName || data.contactPerson || '',
    staffPassword: data.staffPassword || data.password || '',
  }))
  .refine((data) => data.staffName.trim().length >= 2, {
    message: 'Pharmacist / manager name required (min 2 characters)',
    path: ['staffName'],
  })
  .refine((data) => data.staffPassword.length >= 6, {
    message: 'Login password must be at least 6 characters',
    path: ['staffPassword'],
  });

export const createOfflineAppointmentSchema = z.object({
  hospitalId: z.string().min(1, 'Hospital is required'),
  doctorId: z.string().min(1, 'Doctor is required'),
  departmentId: z.string().min(1, 'Department is required').optional().nullable(),
  appointmentDate: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : new Date().toISOString().split('T')[0])),
  timeSlot: z.string().optional().default('Walk-in / Immediate'),
  patient: z.object({
    fullName: z.string().min(2, 'Patient name is required'),
    mobileNumber: z.string().min(10, 'Valid 10-digit mobile number required'),
    email: z.string().email().optional().or(z.literal('')).nullable(),
    dateOfBirth: z.string().optional().nullable(),
    gender: z.string().optional().nullable(),
    age: z.coerce.number().int().min(0).max(130).optional().nullable(),
    address: z.string().optional().nullable(),
    bloodGroup: z.string().optional().nullable(),
    emergencyContact: z.string().optional().nullable(),
  }),
  notes: z.string().optional().nullable(),
  consultationFee: z.coerce.number().min(0).optional(),
});

export const recordVitalsSchema = z.object({
  appointmentId: z.string().min(1, 'Appointment ID is required'),
  patientId: z.string().min(1, 'Patient ID is required'),
  bpSystolic: z.coerce.number().int().min(30).max(350).optional().nullable(),
  bpDiastolic: z.coerce.number().int().min(20).max(250).optional().nullable(),
  bloodPressure: z.string().optional().nullable(), // e.g. "120/80"
  pulseRate: z.coerce.number().int().min(20).max(300).optional().nullable(),
  temperature: z.coerce.number().min(30).max(120).optional().nullable(), // Celsius or Fahrenheit
  spo2: z.coerce.number().int().min(30).max(100).optional().nullable(), // percentage
  weight: z.coerce.number().min(1).max(500).optional().nullable(), // kg
  height: z.coerce.number().min(20).max(300).optional().nullable(), // cm
  notes: z.string().optional().nullable(),
});

export const prescriptionTemplateSchema = z.object({
  diseaseName: z.string().min(2, 'Disease / Condition name required (e.g. Fever, Hypertension)'),
  diagnosis: z.string().optional().nullable(),
  medicines: z.array(
    z.object({
      name: z.string().min(1, 'Medicine name required'),
      dosage: z.string().optional().default('1 dose'),
      frequency: z.string().optional().default('As directed'),
      duration: z.string().optional().default('5 days'),
      instructions: z.string().optional().nullable(),
    })
  ).min(1, 'At least one medicine is required in the template'),
  instructions: z.string().optional().nullable(),
});

export const createLabRequestSchema = z.object({
  appointmentId: z.string().optional().nullable(),
  patientId: z.string().min(1, 'Patient ID is required'),
  labId: z.string().optional().nullable(),
  tests: z.array(
    z.object({
      name: z.string().min(1, 'Test name is required'),
      code: z.string().optional().nullable(),
      price: z.number().optional().nullable(),
      notes: z.string().optional().nullable(),
    })
  ).min(1, 'At least one diagnostic test is required'),
  clinicalNotes: z.string().optional().nullable(),
  priority: z.enum(['NORMAL', 'URGENT']).default('NORMAL'),
});

export const submitLabReportSchema = z.object({
  results: z.string().min(2, 'Test results summary or findings required'),
  fileUrl: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

export const createSubAdminSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().optional().nullable(),
  roleTitle: z.string().optional().default('Hospital Sub-Administrator'),
  permissions: z.array(z.string()).min(1, 'Select at least one administrative permission'),
});

export const updateSubAdminPermissionsSchema = z.object({
  permissions: z.array(z.string()).min(1, 'Select at least one administrative permission'),
  roleTitle: z.string().optional(),
});

