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
};
