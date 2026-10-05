import { api, API_BASE_URL } from './client';
import { Appointment } from '../types';

export const doctorDashboardApi = {
  getAppointments: (date?: string) =>
    api.get<Appointment[]>(`/doctor/appointments${date ? `?date=${date}` : ''}`),

  startConsultation: (appointmentId: string) =>
    api.post<Appointment>(`/doctor/appointments/${appointmentId}/start`),

  completeConsultation: (
    appointmentId: string,
    data: {
      diagnosis: string;
      medicines: Array<{
        name: string;
        dosage: string;
        frequency: string;
        duration: string;
        instructions?: string;
      }>;
      instructions?: string;
      followUpDate?: string;
      symptoms?: string;
      vitals?: {
        bp?: string;
        pulse?: string;
        temperature?: string;
        weight?: string;
        spo2?: string;
      };
      clinicalNotes?: string;
    }
  ) => api.post(`/doctor/appointments/${appointmentId}/complete`, data),

  getPrescription: (appointmentId: string) =>
    api.get<any>(`/doctor/appointments/${appointmentId}/prescription`),

  getProfile: () => api.get<any>('/doctor/profile'),

  updateProfile: (data: any) => api.patch<any>('/doctor/profile', data),

  getStats: () => api.get<any>('/doctor/stats'),

  getSchedules: () => api.get<any[]>('/doctor/schedules'),

  updateSchedules: (schedules: any[]) =>
    api.put<any>('/doctor/schedules', { schedules }),

  getLeaves: () => api.get<any[]>('/doctor/leaves'),

  applyLeave: (data: { startDate: string; endDate: string; reason?: string }) =>
    api.post<any>('/doctor/leaves', data),

  cancelLeave: (leaveId: string) =>
    api.delete<any>(`/doctor/leaves/${leaveId}`),

  // Consultation Details (History + Support Staff Vitals)
  getConsultationDetails: (appointmentId: string) =>
    api.get<any>(`/doctor/appointments/${appointmentId}/consultation`),

  // Disease-Based Prescription Templates
  getTemplates: (search?: string) =>
    api.get<any[]>(`/doctor/templates${search ? `?search=${encodeURIComponent(search)}` : ''}`),

  createTemplate: (data: any) => api.post<any>('/doctor/templates', data),

  bulkCreateTemplates: (templates: any[]) =>
    api.post<any>('/doctor/templates/bulk', { templates }),

  updateTemplate: (templateId: string, data: any) => api.patch<any>(`/doctor/templates/${templateId}`, data),

  deleteTemplate: (templateId: string) => api.delete<any>(`/doctor/templates/${templateId}`),

  // Lab Test Requests
  createLabRequest: (data: any) => api.post<any>('/doctor/lab-requests', data),

  getLabRequests: () => api.get<any[]>('/doctor/lab-requests'),

  // Clinical Consultation Summary PDF
  downloadConsultationPdf: async (appointmentId: string): Promise<Blob> => {
    const token =
      localStorage.getItem('rocketwheel_access_token') ||
      localStorage.getItem('medipulse_access_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/doctor/appointments/${appointmentId}/pdf`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) {
      throw new Error(`Failed to download clinical consultation PDF (${res.status})`);
    }
    return res.blob();
  },
};
