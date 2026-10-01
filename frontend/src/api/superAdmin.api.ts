import { api } from './client';

export const superAdminApi = {
  getMetrics: () => api.get<any>('/super-admin/metrics'),
  getHospitals: () => api.get<any[]>('/super-admin/hospitals'),
  getPendingHospitals: () => api.get<any[]>('/super-admin/pending-hospitals'),
  getHospitalById: (id: string) => api.get<any>(`/super-admin/hospitals/${id}`),
  createHospital: (data: any) => api.post<any>('/super-admin/hospitals', data),
  updateHospital: (id: string, data: any) => api.patch<any>(`/super-admin/hospitals/${id}`, data),
  deleteHospital: (id: string) => api.delete<any>(`/super-admin/hospitals/${id}`),
  approveHospital: (id: string) => api.post<any>(`/super-admin/hospitals/${id}/approve`, {}),
  rejectHospital: (id: string, reason?: string) => api.post<any>(`/super-admin/hospitals/${id}/reject`, { reason }),
  toggleHospitalStatus: (id: string) => api.patch<any>(`/super-admin/hospitals/${id}/status`, {}),
  createHospitalAdmin: (hospitalId: string, data: any) =>
    api.post<any>(`/super-admin/hospitals/${hospitalId}/admin`, data),
  getAllDoctors: (params?: { search?: string; hospitalId?: string; departmentId?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.hospitalId) query.append('hospitalId', params.hospitalId);
    if (params?.departmentId) query.append('departmentId', params.departmentId);
    const qs = query.toString();
    return api.get<any[]>(`/super-admin/doctors${qs ? `?${qs}` : ''}`);
  },
  getAllAppointments: (params?: { date?: string; status?: string; hospitalId?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.date) query.append('date', params.date);
    if (params?.status) query.append('status', params.status);
    if (params?.hospitalId) query.append('hospitalId', params.hospitalId);
    if (params?.limit) query.append('limit', String(params.limit));
    const qs = query.toString();
    return api.get<any[]>(`/super-admin/appointments${qs ? `?${qs}` : ''}`);
  },
  getAllUsers: () => api.get<any[]>('/super-admin/users'),
  getAuditLogs: (limit?: number) => api.get<any[]>(`/super-admin/audit-logs${limit ? `?limit=${limit}` : ''}`),

  // Lab Accreditations & Approvals
  getAllLabs: () => api.get<any[]>('/super-admin/labs'),
  getPendingLabs: () => api.get<any[]>('/super-admin/labs'),
  approveLab: (id: string) => api.patch<any>(`/super-admin/labs/${id}/approve`, {}),
  rejectLab: (id: string, reason?: string) => api.patch<any>(`/super-admin/labs/${id}/reject`, { reason }),

  // OP / Booking Analytics
  getOpAnalytics: (filters: {
    startDate?: string;
    endDate?: string;
    date?: string;
    hospitalId?: string;
    doctorId?: string;
    status?: string;
    bookingType?: string;
  } = {}) => {
    const query = new URLSearchParams();
    if (filters.startDate) query.append('startDate', filters.startDate);
    if (filters.endDate) query.append('endDate', filters.endDate);
    if (filters.date) query.append('date', filters.date);
    if (filters.hospitalId) query.append('hospitalId', filters.hospitalId);
    if (filters.doctorId) query.append('doctorId', filters.doctorId);
    if (filters.status) query.append('status', filters.status);
    if (filters.bookingType) query.append('bookingType', filters.bookingType);
    const qs = query.toString();
    return api.get<any>(`/super-admin/analytics/op${qs ? `?${qs}` : ''}`);
  },

  getExportExcelUrl: (filters: {
    startDate?: string;
    endDate?: string;
    date?: string;
    hospitalId?: string;
    doctorId?: string;
    status?: string;
    bookingType?: string;
  } = {}) => {
    const query = new URLSearchParams();
    if (filters.startDate) query.append('startDate', filters.startDate);
    if (filters.endDate) query.append('endDate', filters.endDate);
    if (filters.date) query.append('date', filters.date);
    if (filters.hospitalId) query.append('hospitalId', filters.hospitalId);
    if (filters.doctorId) query.append('doctorId', filters.doctorId);
    if (filters.status) query.append('status', filters.status);
    if (filters.bookingType) query.append('bookingType', filters.bookingType);
    const qs = query.toString();
    const baseUrl = (api as any).client?.defaults?.baseURL || '/api';
    return `${baseUrl}/super-admin/export/excel${qs ? `?${qs}` : ''}`;
  },
};
