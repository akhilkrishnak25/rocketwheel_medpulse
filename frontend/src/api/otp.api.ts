import { api } from './client';
import { Appointment } from '../types';

export const otpApi = {
  sendOtp: (appointmentNumberOrId: string, mobileNumber: string) =>
    api.post<{ message: string; appointmentId: string; demoOtp?: string }>('/otp/send-otp', {
      appointmentNumberOrId,
      mobileNumber,
    }),

  verifyOtp: (appointmentNumberOrId: string, mobileNumber: string, otpCode: string) =>
    api.post<Appointment>('/otp/verify-otp', {
      appointmentNumberOrId,
      mobileNumber,
      otpCode,
    }),
};
