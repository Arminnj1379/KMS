import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';

@Injectable()
export class HealthService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

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
      throw new ServiceUnavailableException('سرویس آماده نیست');
    }
    return { status: 'ok', checks };
  }
}
