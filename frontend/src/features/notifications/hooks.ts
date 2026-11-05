import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadCount,
  type NotificationParams,
} from './api';

export const notificationKeys = {
  list: (p: NotificationParams) => ['notifications', p] as const,
  unread: () => ['notifications', 'unread-count'] as const,
};

export function useNotifications(p: NotificationParams = {}) {
  return useQuery({ queryKey: notificationKeys.list(p), queryFn: () => listNotifications(p) });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: unreadCount,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

function useInvalidateNotifications() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: ['notifications'] });
  };
}

export function useMarkNotificationRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: invalidate,
  });
}

export function useMarkAllNotificationsRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: invalidate,
  });
}
