import { api, getApiBaseUrl } from './client';
import { LabTestRequest, LabReport } from '../types';

export const labApi = {
  // Lab Admin Dashboard Metrics & Settings
  getStats: () => api.get<any>('/lab/stats'),

  getSettings: () => api.get<any>('/lab/settings'),

  updatePriceVisibility: (showPrices: boolean) =>
    api.patch<any>('/lab/settings/price-visibility', { showPrices }),

  // Technician / Lab Admin Requisitions & Reports
  getRequests: (
    params?:
      | {
          status?: string;
          source?: string;
          search?: string;
          startDate?: string;
          endDate?: string;
          testName?: string;
        }
      | string
  ) => {
    if (typeof params === 'string') {
      return api.get<LabTestRequest[]>(`/lab/requests${params ? `?status=${params}` : ''}`);
    }
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'ALL') query.append('status', params.status);
    if (params?.source && params.source !== 'ALL') query.append('source', params.source);
    if (params?.search) query.append('search', params.search);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.testName) query.append('testName', params.testName);
    const qs = query.toString();
    return api.get<LabTestRequest[]>(`/lab/requests${qs ? `?${qs}` : ''}`);
  },

  updateStatus: (requestId: string, status: string, paymentStatus?: string) =>
    api.patch<LabTestRequest>(`/lab/requests/${requestId}/status`, { status, paymentStatus }),

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

  // Bulk Import & Export of Lab Tests
  downloadSampleTemplate: async (format: 'xlsx' | 'csv' = 'xlsx'): Promise<Blob> => {
    const token =
      localStorage.getItem('rocketwheel_access_token') ||
      localStorage.getItem('medipulse_access_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/lab/tests/sample-template?format=${format}`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) {
      throw new Error(`Failed to download sample template (${res.status})`);
    }
    return res.blob();
  },

  previewImportTests: async (fileOrData: File | { fileData?: string; fileName?: string; rows?: any[] }) => {
    if (fileOrData instanceof File) {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(fileOrData);
      });
      const res = await api.post<any>('/lab/tests/import-preview', {
        fileData: base64,
        fileName: fileOrData.name,
      });
      return res.data;
    }
    const res = await api.post<any>('/lab/tests/import-preview', fileOrData);
    return res.data;
  },

  importTests: async (tests: any[]) => {
    const res = await api.post<any>('/lab/tests/import', { tests });
    return res.data;
  },

  exportTests: async (filters: {
    category?: string;
    department?: string;
    status?: string;
    testIds?: string[];
    search?: string;
    format?: 'xlsx' | 'csv';
  }): Promise<Blob> => {
    const token =
      localStorage.getItem('rocketwheel_access_token') ||
      localStorage.getItem('medipulse_access_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const params = new URLSearchParams();
    if (filters.format) params.append('format', filters.format);
    if (filters.category && filters.category !== 'ALL') params.append('category', filters.category);
    if (filters.department && filters.department !== 'ALL') params.append('department', filters.department);
    if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);
    if (filters.testIds && filters.testIds.length > 0) {
      params.append('testIds', filters.testIds.join(','));
    }

    const baseUrl = getApiBaseUrl();
    const qs = params.toString();
    const res = await fetch(`${baseUrl}/lab/tests/export${qs ? `?${qs}` : ''}`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) {
      throw new Error(`Failed to export lab tests (${res.status})`);
    }
    return res.blob();
  },

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
