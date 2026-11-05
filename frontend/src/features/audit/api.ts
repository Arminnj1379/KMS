import { apiClient } from '../../shared/lib/api-client';

export interface AuditLogItem {
  id: string;
  organizationId: string | null;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: unknown;
  ip: string | null;
  createdAt: string;
}

export interface AuditLogList {
  items: AuditLogItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditLogParams {
  action?: string;
  resourceType?: string;
  actorId?: string;
  page?: number;
  pageSize?: number;
}

function params(p: AuditLogParams): Record<string, unknown> {
  return {
    ...(p.action ? { action: p.action } : {}),
    ...(p.resourceType ? { resourceType: p.resourceType } : {}),
    ...(p.actorId ? { actorId: p.actorId } : {}),
    ...(p.page ? { page: p.page } : {}),
    ...(p.pageSize ? { pageSize: p.pageSize } : {}),
  };
}

export async function listAuditLogs(p: AuditLogParams = {}): Promise<AuditLogList> {
  const { data } = await apiClient.get<AuditLogList>('/audit-logs', { params: params(p) });
  return data;
}
