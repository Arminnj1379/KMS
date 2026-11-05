import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { validateEnv } from './config/env';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  const env = validateEnv(process.env as Record<string, unknown>);

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger, { strict: false }));
  app.use(helmet());
  app.enableCors({ origin: env.corsOrigins, credentials: true });
  app.setGlobalPrefix(env.API_PREFIX);
  // NOTE: URI versioning (/v1) is intentionally deferred to Phase 2, when the
  // first versioned business controllers land. See docs/DECISIONS.md D-011.

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  if (env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('KMS API')
      .setDescription('Enterprise Knowledge Management System — REST API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${env.API_PREFIX}/docs`, app, document, {
      customSiteTitle: 'KMS API — Swagger',
      swaggerOptions: { persistAuthorization: true, docExpansion: 'none', filter: true },
      customCss: `
        :root { color-scheme: dark; }
        body { background: #0b1220 !important; }
        .swagger-ui { color: #e5e7eb; }
        .swagger-ui .topbar { background: #111827; border-bottom: 1px solid #1f2937; }
        .swagger-ui .topbar .topbar-wrapper { background: transparent; }
        .swagger-ui .topbar a { color: #e5e7eb; }
        .swagger-ui .info .title { color: #f9fafb; }
        .swagger-ui .info p, .swagger-ui .info li, .swagger-ui .info table { color: #9ca3af; }
        .swagger-ui .opblock-tag { color: #f3f4f6; border-bottom: 1px solid #1f2937; }
        .swagger-ui .opblock-tag small { color: #9ca3af; }
        .swagger-ui .opblock { background: #111827; border: 1px solid #1f2937; border-radius: 10px; box-shadow: none; margin: 0 0 12px; }
        .swagger-ui .opblock .opblock-summary { border-bottom: 1px solid #1f2937; }
        .swagger-ui .opblock.opblock-get { border-color: #1e3a8a; background: #0f1a33; }
        .swagger-ui .opblock.opblock-post { border-color: #14532d; background: #0f1f17; }
        .swagger-ui .opblock.opblock-put { border-color: #78350f; background: #1f1709; }
        .swagger-ui .opblock.opblock-patch { border-color: #78350f; background: #1f1709; }
        .swagger-ui .opblock.opblock-delete { border-color: #7f1d1d; background: #1f0f0f; }
        .swagger-ui .opblock-summary-method { border-radius: 6px; font-weight: 700; }
        .swagger-ui .opblock-summary-path, .swagger-ui .opblock-summary-path__deprecated { color: #e5e7eb; }
        .swagger-ui .opblock-summary-description { color: #9ca3af; }
        .swagger-ui .opblock-body pre, .swagger-ui .opblock-body .microlight { background: #0b1220 !important; color: #e5e7eb; }
        .swagger-ui .opblock-section-header { background: #1f2937; box-shadow: none; border-bottom: 1px solid #374151; }
        .swagger-ui .opblock-section-header h4 { color: #f3f4f6; }
        .swagger-ui table thead tr th { color: #f3f4f6; border-bottom: 1px solid #374151; }
        .swagger-ui table tbody tr td { color: #d1d5db; border-bottom: 1px solid #1f2937; }
        .swagger-ui .parameter__name, .swagger-ui .parameter__type { color: #93c5fd; }
        .swagger-ui .parameter__in { color: #9ca3af; }
        .swagger-ui .prop-type { color: #93c5fd; }
        .swagger-ui .model-title, .swagger-ui .model { color: #e5e7eb; }
        .swagger-ui section.models { border: 1px solid #1f2937; background: #111827; border-radius: 10px; }
        .swagger-ui section.models h4 { color: #f3f4f6; border-bottom: 1px solid #1f2937; }
        .swagger-ui .model-box { background: #0b1220; }
        .swagger-ui .btn { background: #1f2937; color: #e5e7eb; border: 1px solid #374151; border-radius: 8px; }
        .swagger-ui .btn:hover { background: #374151; }
        .swagger-ui .btn.execute { background: #1d4ed8; border-color: #1d4ed8; color: #fff; }
        .swagger-ui .btn.cancel { background: #7f1d1d; border-color: #7f1d1d; color: #fff; }
        .swagger-ui input, .swagger-ui select, .swagger-ui textarea { background: #0b1220; color: #e5e7eb; border: 1px solid #374151; border-radius: 8px; }
        .swagger-ui .response-col_status { color: #f3f4f6; }
        .swagger-ui .response-col_description { color: #9ca3af; }
        .swagger-ui .microlight { background: #0b1220 !important; }
        .swagger-ui .highlight-code, .swagger-ui .highlight-code pre { background: #0b1220 !important; }
        .swagger-ui .responses-inner h4, .swagger-ui .responses-inner h5 { color: #f3f4f6; }
        .swagger-ui .scheme-container { background: #111827; box-shadow: none; border-bottom: 1px solid #1f2937; }
        .swagger-ui .auth-wrapper { background: #111827; }
        .swagger-ui .dialog-ux .modal-ux { background: #111827; border: 1px solid #1f2937; }
        .swagger-ui .dialog-ux .modal-ux-header h3 { color: #f3f4f6; }
        .swagger-ui .filter .operation-filter-input { background: #0b1220; color: #e5e7eb; border: 1px solid #374151; }
        .swagger-ui .loading-container .loading { filter: invert(1); }
        .swagger-ui .copy-to-clipboard { filter: invert(1); }
      `,
    });
  }

  await app.listen(env.API_PORT, '0.0.0.0');
}

// eslint-disable-next-line no-console
bootstrap().catch((err) => console.error(err));
