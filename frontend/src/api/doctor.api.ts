import { api } from './client';
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
};
