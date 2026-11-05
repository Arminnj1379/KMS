import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [IdentityController],
  providers: [IdentityService],
})
export class IdentityModule {}
