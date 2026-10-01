import { api } from './client';
import { AdminMetrics, Appointment, Doctor, Notification } from '../types';

export const adminApi = {
  getMetrics: () => api.get<AdminMetrics>('/admin/metrics'),

  getAppointments: (params: {
    status?: string;
    date?: string;
    search?: string;
    doctorId?: string;
  } = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.date) query.append('date', params.date);
    if (params.search) query.append('search', params.search);
    if (params.doctorId) query.append('doctorId', params.doctorId);

    const queryString = query.toString();
    return api.get<Appointment[]>(`/admin/appointments${queryString ? `?${queryString}` : ''}`);
  },

  updateAppointmentStatus: (id: string, status: string, notes?: string, cancellationReason?: string) =>
    api.patch<Appointment>(`/admin/appointments/${id}/status`, { status, notes, cancellationReason }),

  getDoctors: () => api.get<Doctor[]>('/admin/doctors'),

  addDoctor: (data: any) => api.post<Doctor>('/admin/doctors', data),

  updateDoctor: (doctorId: string, data: any) => api.patch<Doctor>(`/admin/doctors/${doctorId}`, data),

  approveDoctor: (doctorId: string) => api.patch<Doctor>(`/admin/doctors/${doctorId}/approve`, {}),

  rejectDoctor: (doctorId: string, reason?: string) => api.patch<Doctor>(`/admin/doctors/${doctorId}/reject`, { reason }),

  toggleDoctorStatus: (doctorId: string) => api.patch<Doctor>(`/admin/doctors/${doctorId}/status`, {}),

  bulkImportDoctors: (data: { csvData?: string; rows?: any[]; commit?: boolean }) =>
    api.post<any>('/admin/doctors/bulk-import', data),

  getDepartments: () => api.get<any[]>('/admin/departments'),

  addDepartment: (data: { name: string; code: string; description?: string; icon?: string }) =>
    api.post<any>('/admin/departments', data),

  getHospitalProfile: () => api.get<any>('/admin/profile'),

  updateHospitalProfile: (data: any) => api.patch<any>('/admin/profile', data),

  getDoctorSchedules: (doctorId: string) => api.get<any[]>(`/admin/doctors/${doctorId}/schedules`),

  updateDoctorSchedules: (doctorId: string, schedules: any[]) =>
    api.put<any>(`/admin/doctors/${doctorId}/schedules`, { schedules }),

  getDoctorLeaves: (doctorId: string) => api.get<any[]>(`/admin/doctors/${doctorId}/leaves`),

  addDoctorLeave: (doctorId: string, leave: any) =>
    api.post<any>(`/admin/doctors/${doctorId}/leaves`, leave),

  deleteDoctorLeave: (doctorId: string, leaveId: string) =>
    api.delete<any>(`/admin/doctors/${doctorId}/leaves/${leaveId}`),

  getNotifications: () => api.get<Notification[]>('/admin/notifications'),

  markNotificationRead: (id: string) => api.patch(`/admin/notifications/${id}/read`),

  // Offline OP Bookings
  createOfflineAppointment: (data: any) =>
    api.post<{ appointment: Appointment; digitalOp: any }>('/admin/appointments/offline', data),

  // Pending Doctor Applications
  getPendingDoctors: () => api.get<Doctor[]>('/admin/doctors/pending'),

  // Hospital Patient Records Management
  getPatients: (params: { search?: string; page?: number; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));
    const qs = query.toString();
    return api.get<{ patients: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      `/admin/patients${qs ? `?${qs}` : ''}`
    );
  },

  getHospitalPatients: async (params: { search?: string; page?: number; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));
    const qs = query.toString();
    const res = await api.get<{ patients: any[]; pagination: any }>(
      `/admin/patients${qs ? `?${qs}` : ''}`
    );
    return res?.patients || [];
  },

  getPatientDetails: (patientId: string) => api.get<any>(`/admin/patients/${patientId}`),

  // Support Staff Management
  getSupportStaff: (params?: { search?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    const qs = query.toString();
    return api.get<any[]>(`/admin/support-staff${qs ? `?${qs}` : ''}`);
  },

  approveSupportStaff: (staffId: string) => api.patch<any>(`/admin/support-staff/${staffId}/approve`, {}),

  rejectSupportStaff: (staffId: string) => api.patch<any>(`/admin/support-staff/${staffId}/reject`, {}),

  // Hospital Sub-Admin Management
  getSubAdmins: () => api.get<any[]>('/admin/sub-admins'),

  createSubAdmin: (data: { name: string; email: string; password: string; phone?: string; roleTitle?: string; permissions: string[] }) =>
    api.post<any>('/admin/sub-admins', data),

  updateSubAdminPermissions: (id: string, data: { permissions: string[]; roleTitle?: string }) =>
    api.patch<any>(`/admin/sub-admins/${id}/permissions`, data),

  deleteSubAdmin: (id: string) => api.delete<any>(`/admin/sub-admins/${id}`),
};
