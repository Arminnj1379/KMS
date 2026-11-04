import { apiClient } from '../../shared/lib/api-client';

export type KbVisibility = 'private' | 'internal' | 'public';
export type KbRole = 'manager' | 'contributor' | 'reviewer' | 'reader' | 'org-admin' | null;

export interface Kb {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  icon: string | null;
  visibility: string;
  ownerId: string;
  memberCount: number;
  categoryCount: number;
  createdAt: string;
  updatedAt: string;
  role: KbRole;
}

export interface KbMember {
  userId: string;
  email: string;
  fullName: string;
  isActive: boolean;
  role: string;
  memberSince: string;
}

export interface CategoryNode {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  path: string;
  depth: number;
  position: number;
  children: CategoryNode[];
}

export async function listKbs(): Promise<Kb[]> {
  const { data } = await apiClient.get<Kb[]>('/knowledge-bases');
  return data;
}

export async function getKb(id: string): Promise<Kb> {
  const { data } = await apiClient.get<Kb>(`/knowledge-bases/${id}`);
  return data;
}

export async function createKb(input: {
  title: string;
  slug: string;
  description?: string;
  visibility?: KbVisibility;
}): Promise<Kb> {
  const { data } = await apiClient.post<Kb>('/knowledge-bases', input);
  return data;
}

export async function updateKb(
  id: string,
  input: { title?: string; description?: string; icon?: string; visibility?: KbVisibility },
): Promise<Kb> {
  const { data } = await apiClient.patch<Kb>(`/knowledge-bases/${id}`, input);
  return data;
}

export async function deleteKb(id: string): Promise<void> {
  await apiClient.delete(`/knowledge-bases/${id}`, { params: { confirm: 'true' } });
}

export async function listKbMembers(kbId: string): Promise<KbMember[]> {
  const { data } = await apiClient.get<KbMember[]>(`/knowledge-bases/${kbId}/members`);
  return data;
}

export async function addKbMember(kbId: string, input: { email: string; role: string }): Promise<KbMember> {
  const { data } = await apiClient.post(`/knowledge-bases/${kbId}/members`, input);
  return data as KbMember;
}

export async function updateKbMemberRole(kbId: string, userId: string, role: string): Promise<void> {
  await apiClient.patch(`/knowledge-bases/${kbId}/members/${userId}`, { role });
}

export async function removeKbMember(kbId: string, userId: string): Promise<void> {
  await apiClient.delete(`/knowledge-bases/${kbId}/members/${userId}`);
}

export async function listCategories(kbId: string): Promise<CategoryNode[]> {
  const { data } = await apiClient.get<CategoryNode[]>(`/knowledge-bases/${kbId}/categories`);
  return data;
}

export async function createCategory(
  kbId: string,
  input: { title: string; slug: string; description?: string; parentId?: string },
): Promise<unknown> {
  const { data } = await apiClient.post(`/knowledge-bases/${kbId}/categories`, input);
  return data;
}

export async function updateCategory(
  kbId: string,
  catId: string,
  input: { title?: string; description?: string; parentId?: string | null },
): Promise<unknown> {
  const { data } = await apiClient.patch(`/knowledge-bases/${kbId}/categories/${catId}`, input);
  return data;
}

export async function deleteCategory(kbId: string, catId: string): Promise<void> {
  await apiClient.delete(`/knowledge-bases/${kbId}/categories/${catId}`);
}
