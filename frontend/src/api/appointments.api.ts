import { api } from './client';
import { Appointment, QueueStatus } from '../types';

export interface CreateAppointmentDTO {
  hospitalId: string;
  doctorId: string;
  departmentId: string;
  appointmentDate: string;
  timeSlot: string;
  patient: {
    fullName: string;
    mobileNumber: string;
    email: string;
    age?: number | null;
    dateOfBirth?: string | null;
    gender?: string | null;
    address?: string | null;
    bloodGroup?: string | null;
    emergencyContact?: string | null;
  };
  notes?: string | null;
}

export interface PendingAppointmentResponse {
  appointment: Appointment;
  paymentOrder: {
    orderId: string;
    amount: number;
    amountRupees: number;
    currency: string;
    receipt: string;
    keyId: string;
    appointmentId: string;
  };
}

export const appointmentsApi = {
  create: (dto: CreateAppointmentDTO) =>
    api.post<PendingAppointmentResponse>('/appointments', dto),

  confirmPayment: (dto: {
    appointmentId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) => api.post<{ appointment: Appointment; alreadyConfirmed: boolean }>('/appointments/confirm-payment', dto),

  getById: (id: string) => api.get<Appointment>(`/appointments/${id}`),

  getQueueStatus: (id: string) => api.get<QueueStatus>(`/appointments/${id}/queue`),

  verifyOp: (token: string) => api.get<any>(`/appointments/verify-op/${token}`),

  getPdfUrl: (idOrOp: string) => `/api/appointments/${idOrOp}/pdf`,
};
