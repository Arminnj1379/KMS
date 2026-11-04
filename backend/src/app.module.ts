import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './common/prisma/prisma.module';

/**
 * Root wiring only. Business modules register here as they land
 * (Phase 2: identity/users/organizations, Phase 3: knowledge-bases/...).
 */
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
        transport:
          process.env['NODE_ENV'] === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { colorize: true } },
        autoLogging: true,
        customProps: (req) => ({ requestId: (req as { id?: string }).id }),
      },
    }),
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
