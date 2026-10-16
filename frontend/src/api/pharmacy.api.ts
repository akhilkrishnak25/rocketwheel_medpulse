import { api, getApiBaseUrl } from './client';
import { Prescription } from '../types';

export const pharmacyApi = {
  getPrescriptions: (status?: string) =>
    api.get<Prescription[]>(`/pharmacy/prescriptions${status ? `?status=${status}` : ''}`),

  updateStatus: (prescriptionId: string, status: 'ACCEPTED' | 'PROCESSING' | 'COMPLETED') =>
    api.patch<Prescription>(`/pharmacy/prescriptions/${prescriptionId}/status`, { status }),

  replaceMedicine: (
    prescriptionId: string,
    data: {
      medicineIndex: number;
      originalName?: string;
      replacement: {
        name: string;
        dosage?: string;
        frequency?: string;
        duration?: string;
        instructions?: string;
        strength?: string;
        formulation?: string;
        quantity?: any;
      };
      reason: string;
      doctorApproved?: boolean;
    }
  ) => api.patch<Prescription>(`/pharmacy/prescriptions/${prescriptionId}/replace-medicine`, data),

  downloadPrescriptionPdf: async (prescriptionId: string): Promise<Blob> => {
    const token =
      localStorage.getItem('rocketwheel_access_token') ||
      localStorage.getItem('medipulse_access_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/pharmacy/prescriptions/${prescriptionId}/pdf`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) {
      throw new Error(`Failed to download revised prescription PDF (${res.status})`);
    }
    return res.blob();
  },
};
