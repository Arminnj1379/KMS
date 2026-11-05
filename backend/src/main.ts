import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import * as fs from 'fs';
import * as path from 'path';
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

    let swaggerDarkCss = '';
    try {
      const cssPath = path.join(__dirname, 'swagger-dark.css');
      swaggerDarkCss = fs.readFileSync(cssPath, 'utf8');
    } catch {
      swaggerDarkCss = '';
    }

    SwaggerModule.setup(`${env.API_PREFIX}/docs`, app, document, {
      customSiteTitle: 'KMS API — Swagger',
      swaggerOptions: { persistAuthorization: true, docExpansion: 'none', filter: true },
      customCss: swaggerDarkCss,
    });
  }

  await app.listen(env.API_PORT, '0.0.0.0');
}

// eslint-disable-next-line no-console
bootstrap().catch((err) => console.error(err));