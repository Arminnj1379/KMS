import { apiClient } from '../../shared/lib/api-client';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  locale: string;
  isActive: boolean;
}

export interface AuthOrganization {
  id: string;
  name: string;
  slug: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  organization: AuthOrganization;
  orgRole: 'org-admin' | 'member';
}

export interface MembershipRow {
  organization: AuthOrganization;
  role: 'org-admin' | 'member';
  department: { id: string; name: string } | null;
}

export interface MeResponse {
  user: AuthUser;
  memberships: MembershipRow[];
}

export interface OrgUserRow {
  user: AuthUser;
  role: string;
  department: { id: string; name: string } | null;
  memberSince: string;
}

const ACCESS_KEY = 'kms_access_token';
const REFRESH_KEY = 'kms_refresh_token';

export function readTokens(): { access: string | null; refresh: string | null } {
  return { access: localStorage.getItem(ACCESS_KEY), refresh: localStorage.getItem(REFRESH_KEY) };
}

export function storeTokens(access: string, refresh: string): void {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', { email, password });
  storeTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function register(input: {
  fullName: string;
  email: string;
  password: string;
  organizationName: string;
}): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/register', input);
  storeTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function logout(): Promise<void> {
  const { refresh } = readTokens();
  try {
    if (refresh) await apiClient.post('/auth/logout', { refreshToken: refresh });
  } finally {
    clearTokens();
  }
}

export async function fetchMe(): Promise<MeResponse> {
  const { data } = await apiClient.get<MeResponse>('/auth/me');
  return data;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.patch('/auth/password', { currentPassword, newPassword });
  clearTokens();
}

export async function listUsers(params: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<{ data: OrgUserRow[]; total: number }> {
  const { data } = await apiClient.get('/users', { params });
  return data as { data: OrgUserRow[]; total: number };
}

export async function inviteUser(input: {
  email: string;
  fullName: string;
  password: string;
  role: 'org-admin' | 'member';
}): Promise<OrgUserRow> {
  const { data } = await apiClient.post('/users', input);
  return data as OrgUserRow;
}

export async function updateUser(
  id: string,
  input: { fullName?: string; isActive?: boolean; role?: 'org-admin' | 'member' },
): Promise<OrgUserRow> {
  const { data } = await apiClient.patch(`/users/${id}`, input);
  return data as OrgUserRow;
}
