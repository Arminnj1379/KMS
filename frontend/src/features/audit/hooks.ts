import { useQuery } from '@tanstack/react-query';
import { listAuditLogs, type AuditLogParams } from './api';

export const auditKeys = {
  list: (p: AuditLogParams) => ['audit-logs', p] as const,
};

export function useAuditLogs(p: AuditLogParams = {}, enabled = true) {
  return useQuery({ queryKey: auditKeys.list(p), queryFn: () => listAuditLogs(p), enabled });
}
