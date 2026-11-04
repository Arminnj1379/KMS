import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { StorageService } from '../../common/storage/storage.service';

@Injectable()
export class HealthService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly storage: StorageService,
  ) {}

  liveness(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  async readiness(): Promise<{ status: string; checks: Record<string, string> }> {
    const checks: Record<string, string> = {};
    try {
      const db = this.connection.db;
      if (!db) throw new Error('no database connection');
      await db.admin().ping();
      checks['database'] = 'up';
    } catch {
      checks['database'] = 'down';
    }
    try {
      checks['storage'] = (await this.storage.isHealthy()) ? 'up' : 'down';
    } catch {
      checks['storage'] = 'down';
    }
    if (checks['database'] !== 'up' || checks['storage'] !== 'up') {
      throw new ServiceUnavailableException('سرویس آماده نیست');
    }
    return { status: 'ok', checks };
  }
}
