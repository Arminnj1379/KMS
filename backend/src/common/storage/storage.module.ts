import { Module } from '@nestjs/common';
import { parseStorageConfig } from './storage.config';
import { StorageService } from './storage.service';

/**
 * Shared storage seam (D-007/D-020). Imported by DocumentsModule (uploads)
 * and HealthModule (readiness). `common/` never imports from `modules/`.
 */
@Module({
  providers: [
    {
      provide: StorageService,
      useFactory: () => new StorageService(parseStorageConfig(process.env as Record<string, unknown>)),
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
