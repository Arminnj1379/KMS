import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { RolesGuard } from './common/auth/roles.guard';
import { MongoModule } from './common/mongo/mongo.module';
import { HealthModule } from './modules/health/health.module';
import { IdentityModule } from './modules/identity/identity.module';
import { KnowledgeBasesModule } from './modules/knowledge-bases/knowledge-bases.module';
import { ArticlesModule } from './modules/articles/articles.module';
import { ArticleVersionsModule } from './modules/article-versions/article-versions.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { UsersModule } from './modules/users/users.module';

/**
 * Root wiring only. Module dependency direction:
 * users/organizations → permissions; identity stands alone (bootstrap).
 * common/ never imports from modules/.
 * Persistence: global MongoModule (Mongoose) replaces PrismaModule.
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
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 200 }]),
    JwtModule.register({ global: true }),
    MongoModule,
    PermissionsModule,
    IdentityModule,
    UsersModule,
    OrganizationsModule,
    KnowledgeBasesModule,
    ArticlesModule,
    ArticleVersionsModule,
    DocumentsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
