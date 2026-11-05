import axios, { type AxiosInstance } from 'axios';

const baseURL = import.meta.env.VITE_API_URL ?? '/api';

export const apiClient: AxiosInstance = axios.create({
  baseURL,
  timeout: 15000,
  withCredentials: false,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('kms_access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const requestId = crypto.randomUUID();
  config.headers['x-request-id'] = requestId;
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const url = error.config?.url ?? '';
      const isAuthRoute = url.includes('/auth/login') || url.includes('/auth/register');
      if (!isAuthRoute) {
        localStorage.removeItem('kms_access_token');
        localStorage.removeItem('kms_refresh_token');
        if (window.location.pathname !== '/login') window.location.assign('/login');
      }
    }
    throw error;
  },
);

export interface ApiErrorEnvelope {
  statusCode: number;
  message: string;
  code: string;
  requestId?: string;
  /** Optimistic-concurrency 409s carry the current document here (Phase 11). */
  current?: unknown;
}

export function toApiMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorEnvelope>(error)) {
    const msg = error.response?.data?.message;
    if (typeof msg === 'string' && msg.length > 0) return msg;
  }
  return fallback;
}
