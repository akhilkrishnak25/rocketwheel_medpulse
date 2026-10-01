import { api } from './client';
import { Appointment, PatientVital } from '../types';

export const supportStaffApi = {
  getQueue: (date?: string) =>
    api.get<Appointment[]>(`/support-staff/queue${date ? `?date=${date}` : ''}`),

  recordVitals: (data: {
    appointmentId: string;
    patientId: string;
    bpSystolic?: number | null;
    bpDiastolic?: number | null;
    bloodPressure?: string | null;
    pulseRate?: number | null;
    temperature?: number | null;
    spo2?: number | null;
    weight?: number | null;
    height?: number | null;
    notes?: string | null;
  }) => api.post<PatientVital>('/support-staff/vitals', data),

  getVitals: (appointmentId: string) =>
    api.get<PatientVital>(`/support-staff/vitals/${appointmentId}`),
};
