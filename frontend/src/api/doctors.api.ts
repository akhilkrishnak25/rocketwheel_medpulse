import { api } from './client';
import { Doctor, DoctorAvailability } from '../types';

export const doctorsApi = {
  getById: (id: string) => api.get<Doctor>(`/doctors/${id}`),

  getAvailability: (doctorId: string, date: string) =>
    api.get<DoctorAvailability>(`/doctors/${doctorId}/availability?date=${date}`),
};
