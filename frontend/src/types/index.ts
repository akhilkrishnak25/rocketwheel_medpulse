export type UserRole =
  | 'SUPER_ADMIN'
  | 'HOSPITAL_ADMIN'
  | 'HOSPITAL_SUB_ADMIN'
  | 'DOCTOR'
  | 'SUPPORT_STAFF'
  | 'LAB_TECHNICIAN'
  | 'PHARMACY_STAFF'
  | 'PATIENT';

export type UserStatus = 'ACTIVE' | 'PENDING' | 'REJECTED' | 'SUSPENDED' | 'INVITED';
export type HospitalStatus = 'PENDING' | 'APPROVED' | 'ACTIVE' | 'REJECTED' | 'INACTIVE';
export type DoctorStatus = 'PENDING' | 'APPROVED' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status?: UserStatus;
  avatarUrl?: string | null;
  lastLoginAt?: string;
  hospital?: {
    id: string;
    name: string;
    slug: string;
    code: string;
    status?: HospitalStatus;
  };
  doctor?: Doctor;
  hospitalSubAdmin?: HospitalSubAdmin;
  supportStaff?: SupportStaff;
  labTechnician?: any;
  pharmacyStaff?: any;
  lab?: any;
  pharmacy?: any;
  subAdminPermissions?: string[];
}

export interface Hospital {
  id: string;
  name: string;
  slug: string;
  code: string;
  status?: HospitalStatus;
  website?: string;
  logoUrl?: string;
  imageUrl?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  emergencyContact: string;
  openingHours: string;
  about: string;
  facilities: string[];
  rating: number;
  isEmergencyAvailable: boolean;
  doctorCount: number;
  departments: Department[];
  minConsultationFee?: number;
}

export interface Department {
  id: string;
  name: string;
  slug: string;
  code?: string;
  description?: string;
  icon?: string;
}

export interface Doctor {
  id: string;
  name: string;
  photoUrl?: string;
  qualification: string;
  specialization: string;
  experienceYears: number;
  consultationFee: number;
  languages: string;
  about: string;
  workingDays: string;
  status?: DoctorStatus;
  isActive: boolean;
  workingHoursStart: string;
  workingHoursEnd: string;
  slotDurationMinutes: number;
  breakStart?: string;
  breakEnd?: string;
  hospitalId: string;
  departmentId: string;
  hospital?: Partial<Hospital>;
  department?: Department;
  reviews?: Review[];
  averageRating?: number;
  reviewCount?: number;
}

export interface Review {
  id: string;
  patientName: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface TimeSlot {
  time: string;
  time24: string;
  isAvailable: boolean;
  status: 'AVAILABLE' | 'BOOKED' | 'BREAK';
}

export interface DoctorAvailability {
  date: string;
  isWorkingDay: boolean;
  doctorName?: string;
  consultationFee?: number;
  slotDurationMinutes?: number;
  totalSlots: number;
  availableCount: number;
  reason?: string;
  slots: TimeSlot[];
}

export type AppointmentStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'WAITING'
  | 'IN_CONSULTATION'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type BookingType = 'ONLINE' | 'OFFLINE';

export interface Patient {
  id: string;
  patientIdNumber?: string;
  hospitalId?: string;
  fullName: string;
  mobileNumber: string;
  email: string;
  age?: number | null;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  bloodGroup?: string;
  emergencyContact?: string;
  _count?: {
    appointments?: number;
    prescriptions?: number;
    labRequests?: number;
    vitals?: number;
  };
}

export interface DigitalOP {
  id: string;
  opNumber: string;
  secureToken: string;
  qrData: string;
  isVerified: boolean;
  verifiedAt?: string;
  downloadCount: number;
  createdAt: string;
}

export interface Payment {
  id: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  paymentMethod?: string;
}

export interface Prescription {
  id: string;
  appointmentId?: string;
  appointment?: Appointment;
  diagnosis: string;
  medicines: string; // JSON string
  medicinesList?: Array<{ name: string; dosage: string; frequency: string; duration: string; instructions?: string }>;
  instructions?: string;
  followUpDate?: string;
  pharmacyStatus?: 'NONE' | 'SENT' | 'ACCEPTED' | 'PROCESSING' | 'COMPLETED';
  sentToPharmacyAt?: string;
  dispensedAt?: string;
  dispensedBy?: string;
  doctor?: Doctor;
  pharmacy?: { name: string };
  createdAt: string;
}

export interface PatientVital {
  id: string;
  hospitalId: string;
  patientId: string;
  appointmentId?: string;
  recordedBy?: string;
  recordedByName?: string;
  bpSystolic?: number;
  bpDiastolic?: number;
  bloodPressure?: string;
  pulseRate?: number;
  temperature?: number;
  spo2?: number;
  weight?: number;
  height?: number;
  notes?: string;
  createdAt: string;
}

export interface PrescriptionTemplate {
  id: string;
  doctorId: string;
  diseaseName: string;
  diagnosis?: string;
  medicines: string;
  medicinesList?: Array<{ name: string; dosage: string; frequency: string; duration: string; instructions?: string }>;
  instructions?: string;
  createdAt: string;
}

export interface Lab {
  id: string;
  name: string;
  type: 'HOSPITAL' | 'INDEPENDENT';
  hospitalId?: string;
  hospital?: { name: string; code: string };
  email: string;
  phone: string;
  address?: string;
  city?: string;
  licenseNumber?: string;
  status: 'PENDING' | 'APPROVED' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';
  _count?: { testRequests?: number };
}

export interface LabReport {
  id: string;
  testRequestId: string;
  technicianName?: string;
  results: string;
  fileUrl?: string;
  remarks?: string;
  completedAt: string;
}

export interface LabTest {
  id: string;
  labId?: string;
  hospitalId?: string;
  name: string;
  code?: string;
  category?: string;
  description?: string;
  price: number;
  status: string;
  tatHours?: number;
  lab?: Lab;
  hospital?: Hospital;
  createdAt?: string;
  updatedAt?: string;
}

export interface LabTestRequest {
  id: string;
  requestNumber: string;
  patientId: string;
  hospitalId?: string;
  doctorId?: string;
  appointmentId?: string;
  labId?: string;
  tests: string;
  testsList?: Array<{ id?: string; name: string; code?: string; price?: number; tatHours?: number; notes?: string }>;
  clinicalNotes?: string;
  priority: 'NORMAL' | 'URGENT';
  status: string;
  preferredDate?: string;
  totalAmount?: number;
  report?: LabReport;
  patient?: Patient;
  doctor?: Doctor;
  hospital?: Hospital;
  lab?: Lab;
  createdAt: string;
}

export interface SupportStaff {
  id: string;
  userId: string;
  user?: { name: string; email: string; phone?: string; status: string; lastLoginAt?: string };
  hospitalId: string;
  departmentId?: string;
  roleTitle: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE';
  approvedAt?: string;
  createdAt: string;
}

export interface HospitalSubAdmin {
  id: string;
  userId: string;
  user?: { name: string; email: string; phone?: string; status: string; lastLoginAt?: string };
  hospitalId: string;
  roleTitle: string;
  permissions: string;
  permissionsList?: string[];
  createdAt: string;
}

export interface Appointment {
  id: string;
  appointmentNumber: string;
  hospitalId: string;
  doctorId: string;
  patientId: string;
  departmentId: string;
  appointmentDate: string;
  timeSlot: string;
  tokenNumber: number;
  status: AppointmentStatus;
  bookingType: BookingType;
  consultationFee: number;
  platformFee: number;
  totalAmount: number;
  notes?: string;
  cancellationReason?: string;
  hospital: Hospital;
  doctor: Doctor;
  patient: Patient;
  department: Department;
  payment?: Payment;
  digitalOp?: DigitalOP;
  prescription?: Prescription;
  vitals?: PatientVital[];
  labRequests?: LabTestRequest[];
  createdAt: string;
}

export interface QueueStatus {
  yourToken: number;
  currentToken: number;
  patientsAhead: number;
  appointmentStatus: AppointmentStatus;
  doctorName: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  metadata?: string;
  createdAt: string;
}

export interface AdminMetrics {
  todayAppointments: number;
  upcomingAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  todayRevenue: number;
  totalRevenue: number;
  doctorCount: number;
  patientCount: number;
  totalAppointments: number;
  recentNotifications: Notification[];
}

export interface HierarchicalDoctorStats {
  doctorId: string;
  doctorName: string;
  specialization: string;
  totalOp: number;
  onlineOp: number;
  offlineOp: number;
  completedOp: number;
  cancelledOp: number;
}

export interface HierarchicalHospitalStats {
  hospitalId: string;
  hospitalName: string;
  hospitalCode: string;
  totalOp: number;
  onlineOp: number;
  offlineOp: number;
  completedOp: number;
  cancelledOp: number;
  doctors: HierarchicalDoctorStats[];
}

export interface OpAnalyticsResponse {
  summary: {
    totalOpCount: number;
    onlineBookingCount: number;
    offlineBookingCount: number;
    completedCount: number;
    cancelledCount: number;
    totalRevenue: number;
  };
  hierarchical: HierarchicalHospitalStats[];
}
