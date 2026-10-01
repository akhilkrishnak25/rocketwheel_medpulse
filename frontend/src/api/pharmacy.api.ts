import { api } from './client';
import { Prescription } from '../types';

export const pharmacyApi = {
  getPrescriptions: (status?: string) =>
    api.get<Prescription[]>(`/pharmacy/prescriptions${status ? `?status=${status}` : ''}`),

  updateStatus: (prescriptionId: string, status: 'ACCEPTED' | 'PROCESSING' | 'COMPLETED') =>
    api.patch<Prescription>(`/pharmacy/prescriptions/${prescriptionId}/status`, { status }),
};
