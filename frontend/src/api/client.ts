const API_BASE_URL = ((import.meta as any).env?.VITE_API_URL as string) || '/api';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
  error?: any;
}

export async function apiClient<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('rocketwheel_access_token') || localStorage.getItem('medipulse_access_token');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const json: ApiResponse<T> = await response.json().catch(() => ({
    success: false,
    message: 'Invalid server response',
    data: null as any,
  }));

  if (!response.ok || !json.success) {
    let errorMessage = json.message || `Request failed with status ${response.status}`;
    if (typeof errorMessage === 'string' && errorMessage.trim().startsWith('[') && errorMessage.trim().endsWith(']')) {
      try {
        const parsed = JSON.parse(errorMessage);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].message) {
          errorMessage = parsed
            .map((err: any) => {
              const field = Array.isArray(err.path) && err.path.length ? `${err.path[err.path.length - 1]}: ` : '';
              if (err.code === 'invalid_type' && err.received === 'undefined') return `${field}is required`;
              if (err.code === 'invalid_enum_value') return `Please select a valid option for ${field.replace(':', '')}`;
              return `${field}${err.message}`;
            })
            .join('; ');
        }
      } catch {}
    }

    if (errorMessage.includes('invalid_enum_value') || errorMessage.includes('Invalid enum value')) {
      errorMessage = 'Please select a valid option from the dropdown menu.';
    }
    if (errorMessage.includes('received undefined') || errorMessage.includes('Expected string, received undefined')) {
      errorMessage = 'Please complete all required fields.';
    }

    throw new Error(errorMessage);
  }

  if (json.data && typeof json.data === 'object' && json.message && !(json.data as any).message) {
    (json.data as any).message = json.message;
  }

  return json.data;
}

export const api = {
  get: <T>(endpoint: string) => apiClient<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body?: any) =>
    apiClient<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(endpoint: string, body?: any) =>
    apiClient<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: <T>(endpoint: string, body?: any) =>
    apiClient<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(endpoint: string) =>
    apiClient<T>(endpoint, { method: 'DELETE' }),
};
