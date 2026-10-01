import { api } from './client';
import { Hospital, Doctor, Department } from '../types';

export const hospitalsApi = {
  list: (params: {
    search?: string;
    city?: string;
    department?: string;
    isEmergencyAvailable?: boolean;
    minRating?: number;
    sortBy?: string;
  } = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.city) query.append('city', params.city);
    if (params.department) query.append('department', params.department);
    if (params.isEmergencyAvailable !== undefined)
      query.append('isEmergencyAvailable', String(params.isEmergencyAvailable));
    if (params.minRating) query.append('minRating', String(params.minRating));
    if (params.sortBy) query.append('sortBy', params.sortBy);

    const queryString = query.toString();
    return api.get<Hospital[]>(`/hospitals${queryString ? `?${queryString}` : ''}`);
  },

  getAll: () => api.get<Hospital[]>('/hospitals'),

  getById: (id: string) => api.get<Hospital>(`/hospitals/${id}`),

  getDoctors: (hospitalId: string, params: {
    department?: string;
    specialization?: string;
    maxFee?: number;
    search?: string;
  } = {}) => {
    const query = new URLSearchParams();
    if (params.department) query.append('department', params.department);
    if (params.specialization) query.append('specialization', params.specialization);
    if (params.maxFee) query.append('maxFee', String(params.maxFee));
    if (params.search) query.append('search', params.search);

    const queryString = query.toString();
    return api.get<Doctor[]>(`/hospitals/${hospitalId}/doctors${queryString ? `?${queryString}` : ''}`);
  },

  getDepartments: () => api.get<Department[]>('/hospitals/departments'),
};
