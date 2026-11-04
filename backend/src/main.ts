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
    SwaggerModule.setup(`${env.API_PREFIX}/docs`, app, document);
  }

  await app.listen(env.API_PORT, '0.0.0.0');
}

// eslint-disable-next-line no-console
bootstrap().catch((err) => console.error(err));
