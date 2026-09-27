export type UserRole = 'SUPER_ADMIN' | 'HOSPITAL_ADMIN' | 'DOCTOR';
export type UserStatus = 'ACTIVE' | 'PENDING' | 'REJECTED' | 'SUSPENDED' | 'INVITED';
export type HospitalStatus = 'PENDING' | 'APPROVED' | 'ACTIVE' | 'REJECTED' | 'INACTIVE';
export type DoctorStatus = 'PENDING' | 'APPROVED' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status?: UserStatus;
  lastLoginAt?: string;
  hospital?: {
    id: string;
    name: string;
    slug: string;
    code: string;
    status?: HospitalStatus;
  };
  doctor?: Doctor;
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

export interface Patient {
  id: string;
  fullName: string;
  mobileNumber: string;
  email: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  bloodGroup?: string;
  emergencyContact?: string;
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
  diagnosis: string;
  medicines: string; // JSON
  instructions?: string;
  followUpDate?: string;
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
