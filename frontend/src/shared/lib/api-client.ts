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

export interface ApiErrorEnvelope {
  statusCode: number;
  message: string;
  code: string;
  requestId?: string;
}

export function toApiMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorEnvelope>(error)) {
    const msg = error.response?.data?.message;
    if (typeof msg === 'string' && msg.length > 0) return msg;
  }
  return fallback;
}
