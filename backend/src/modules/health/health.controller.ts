import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness probe (no dependencies)' })
  liveness(): { status: string; timestamp: string } {
    return this.health.liveness();
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (checks MongoDB + object storage)' })
  async readiness(): Promise<{ status: string; checks: Record<string, string> }> {
    return this.health.readiness();
  }
}
