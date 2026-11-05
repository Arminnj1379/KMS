import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog } from '../../common/mongo/schemas/audit-log.schema';
import { ListAuditLogsQuery } from './dto/audit-logs.dto';

export interface AuditWriteInput {
  organizationId?: string | null;
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: unknown;
  ip?: string | null;
}

type AuditLean = {
  organizationId: string | null;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: unknown;
  ip: string | null;
  createdAt: Date;
};

/**
 * Append-only audit log (Phase 8, D-005). `write()` is an explicit
 * post-success hook: it never throws and never runs inside a request
 * transaction, so audit outages can't fail the request (same posture as
 * the notifications `safeNotify` seam). Callers invoke it after the commit.
 *
 * Direction: sink. Imports nothing from other modules.
 */
@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(@InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLog>) {}

  async write(input: AuditWriteInput): Promise<void> {
    try {
      await this.auditModel.create({
        organizationId: input.organizationId ?? null,
        actorId: input.actorId ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        metadata: input.metadata ?? null,
        ip: input.ip ?? null,
      });
    } catch (error) {
      this.logger.warn(`audit write failed (${input.action}): ${(error as Error).message}`);
    }
  }

  /** Org-scoped query (login rows carry their membership org; no null-org rows leak). */
  async list(orgId: string, query: ListAuditLogsQuery) {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));
    const filter: Record<string, unknown> = { organizationId: orgId };
    if (query.action) filter['action'] = query.action;
    if (query.resourceType) filter['resourceType'] = query.resourceType;
    if (query.actorId) filter['actorId'] = query.actorId;
    const [total, rows] = await Promise.all([
      this.auditModel.countDocuments(filter),
      this.auditModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);
    return {
      items: (rows as unknown as (AuditLean & { _id: { toHexString(): string } })[]).map((r) => ({
        id: r._id.toHexString(),
        organizationId: r.organizationId,
        actorId: r.actorId,
        action: r.action,
        resourceType: r.resourceType,
        resourceId: r.resourceId,
        metadata: r.metadata,
        ip: r.ip,
        createdAt: r.createdAt,
      })),
      total,
      page,
      pageSize,
    };
  }
}
