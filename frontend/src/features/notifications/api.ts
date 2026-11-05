import { apiClient } from '../../shared/lib/api-client';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: unknown;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationList {
  items: NotificationItem[];
  total: number;
  unread: number;
  page: number;
  pageSize: number;
}

export interface NotificationParams {
  isRead?: boolean;
  page?: number;
  pageSize?: number;
}

function params(p: NotificationParams): Record<string, unknown> {
  return {
    ...(p.isRead !== undefined ? { isRead: String(p.isRead) } : {}),
    ...(p.page ? { page: p.page } : {}),
    ...(p.pageSize ? { pageSize: p.pageSize } : {}),
  };
}

export async function listNotifications(p: NotificationParams = {}): Promise<NotificationList> {
  const { data } = await apiClient.get<NotificationList>('/notifications', { params: params(p) });
  return data;
}

export async function unreadCount(): Promise<{ unread: number }> {
  const { data } = await apiClient.get<{ unread: number }>('/notifications/unread-count');
  return data;
}

export async function markNotificationRead(id: string): Promise<NotificationItem> {
  const { data } = await apiClient.patch<NotificationItem>(`/notifications/${id}/read`);
  return data;
}

export async function markAllNotificationsRead(): Promise<{ updated: number }> {
  const { data } = await apiClient.patch<{ updated: number }>('/notifications/read-all');
  return data;
}
