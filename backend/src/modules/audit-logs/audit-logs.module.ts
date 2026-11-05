import { Module } from '@nestjs/common';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';

/**
 * Audit sink (Phase 8, D-005). Owns the append-only `audit_logs` writer +
 * org-admin query. Direction: every module → audit-logs; audit-logs
 * imports nothing.
 */
@Module({
  controllers: [AuditLogsController],
  providers: [AuditLogsService],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
