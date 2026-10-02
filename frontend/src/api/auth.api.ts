import { api } from './client';
import { User } from '../types';

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterDoctorDTO {
  name: string;
  email: string;
  password: string;
  phone: string;
  hospitalId: string;
  departmentId: string;
  qualification: string;
  specialization: string;
  experienceYears?: number;
  consultationFee?: number;
  languages?: string;
  about?: string;
  workingDays?: string;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  slotDurationMinutes?: number;
}

export interface RegisterLabDTO {
  name: string;
  type?: 'HOSPITAL' | 'INDEPENDENT';
  hospitalId?: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  licenseNumber: string;
  adminName?: string;
  contactPerson?: string;
  adminPassword?: string;
  password?: string;
  state?: string;
  pincode?: string;
}

export interface RegisterSupportStaffDTO {
  name: string;
  email: string;
  password: string;
  phone: string;
  hospitalId: string;
  departmentId?: string | null;
  department?: string | null;
  roleTitle?: string;
}

export interface RegisterPharmacyDTO {
  name: string;
  hospitalId?: string | null;
  email: string;
  phone: string;
  address?: string | null;
  licenseNumber: string;
  staffName?: string;
  contactPerson?: string;
  staffPassword?: string;
  password?: string;
  adminName?: string;
  adminPassword?: string;
}

export const authApi = {
  login: (credentials: { email: string; password: string }) =>
    api.post<LoginResponse>('/auth/login', credentials),

  me: () => api.get<User>('/auth/me'),

  refreshToken: (refreshToken: string) =>
    api.post<{ accessToken: string; refreshToken: string }>('/auth/refresh-token', { refreshToken }),

  forgotPassword: (email: string) =>
    api.post<{ message: string; resetToken?: string; resetLink?: string }>('/auth/forgot-password', { email }),

  verifyToken: (token: string, type: 'ACTIVATION' | 'PASSWORD_RESET') =>
    api.get<{ valid: boolean; email?: string }>(`/auth/verify-token?token=${encodeURIComponent(token)}&type=${encodeURIComponent(type)}`),

  resetPassword: (payload: { token: string; newPassword: string }) =>
    api.post<{ message: string }>('/auth/reset-password', payload),

  activateAccount: (payload: { token: string; password: string }) =>
    api.post<{ message: string }>('/auth/activate', payload),

  registerHospital: (payload: any) =>
    api.post<{ message: string; hospitalId?: string }>('/auth/register-hospital', payload),

  registerDoctor: (payload: RegisterDoctorDTO) =>
    api.post<{ message: string; id?: string }>('/auth/register-doctor', payload),

  registerLab: (payload: RegisterLabDTO) =>
    api.post<{ message: string; labId?: string }>('/auth/register-lab', payload),

  registerSupportStaff: (payload: RegisterSupportStaffDTO) =>
    api.post<{ message: string; id?: string }>('/auth/register-support-staff', payload),

  registerPharmacy: (payload: RegisterPharmacyDTO) =>
    api.post<{ message: string; pharmacyId?: string }>('/auth/register-pharmacy', payload),
};

