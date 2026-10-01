import { api } from './client';
import { LabTestRequest, LabReport } from '../types';

export const labApi = {
  getRequests: (status?: string) =>
    api.get<LabTestRequest[]>(`/lab/requests${status ? `?status=${status}` : ''}`),

  updateStatus: (requestId: string, status: 'RECEIVED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED') =>
    api.patch<LabTestRequest>(`/lab/requests/${requestId}/status`, { status }),

  submitReport: (
    requestId: string,
    data: {
      results: string;
      fileUrl?: string | null;
      remarks?: string | null;
    }
  ) => api.post<LabReport>(`/lab/requests/${requestId}/report`, data),
};
