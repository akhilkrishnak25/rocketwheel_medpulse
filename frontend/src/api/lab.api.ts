import { api } from './client';
import { LabTestRequest, LabReport } from '../types';

export const labApi = {
  // Technician Requisitions & Reports
  getRequests: (status?: string) =>
    api.get<LabTestRequest[]>(`/lab/requests${status ? `?status=${status}` : ''}`),

  updateStatus: (requestId: string, status: string) =>
    api.patch<LabTestRequest>(`/lab/requests/${requestId}/status`, { status }),

  submitReport: (
    requestId: string,
    data: {
      results: string;
      fileUrl?: string | null;
      remarks?: string | null;
    }
  ) => api.post<LabReport>(`/lab/requests/${requestId}/report`, data),

  // Technician Test Catalog & Pricing (CRUD)
  getTests: (category?: string, search?: string) => {
    const params = new URLSearchParams();
    if (category && category !== 'ALL') params.append('category', category);
    if (search) params.append('search', search);
    const qs = params.toString();
    return api.get<any[]>(`/lab/tests${qs ? `?${qs}` : ''}`);
  },

  createTest: (data: {
    code?: string;
    name: string;
    category?: string;
    description?: string;
    tatHours?: number;
    price: number;
    status?: string;
  }) => api.post<any>('/lab/tests', data),

  updateTest: (
    testId: string,
    data: {
      code?: string;
      name?: string;
      category?: string;
      description?: string;
      tatHours?: number;
      price?: number;
      status?: string;
    }
  ) => api.patch<any>(`/lab/tests/${testId}`, data),

  toggleTest: (testId: string) => api.patch<any>(`/lab/tests/${testId}/toggle`),

  deleteTest: (testId: string) => api.delete<any>(`/lab/tests/${testId}`),

  // Public & Customer-Facing Lab APIs
  getActiveLabs: (hospitalId?: string) =>
    api.get<any[]>(`/labs/active${hospitalId ? `?hospitalId=${hospitalId}` : ''}`),

  getPublicTests: (params?: { labId?: string; category?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.labId) query.append('labId', params.labId);
    if (params?.category && params.category !== 'ALL') query.append('category', params.category);
    if (params?.search) query.append('search', params.search);
    const qs = query.toString();
    return api.get<any[]>(`/labs/tests${qs ? `?${qs}` : ''}`);
  },

  bookTest: (data: {
    labId: string;
    patientName: string;
    mobileNumber: string;
    email?: string;
    gender?: string;
    age?: number;
    address?: string;
    preferredDate?: string;
    testIds: string[];
    notes?: string;
  }) => api.post<any>('/labs/book', data),

  getBookingStatus: (idOrNumber: string) =>
    api.get<any>(`/labs/booking/${encodeURIComponent(idOrNumber)}`),
};
