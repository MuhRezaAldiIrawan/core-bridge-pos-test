import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppLogger } from './common/logger/logger.service';

async function bootstrap(): Promise<void> {
  const logger = new AppLogger();

  try {
    const app = await NestFactory.create(AppModule, { bufferLogs: true });
    app.useLogger(logger);
    const configService = app.get(ConfigService);

    const trustProxy = configService.get<boolean>('trustProxy', false);
    if (trustProxy) {
      const httpAdapter = app.getHttpAdapter() as unknown as {
        getInstance?: () => unknown;
      };
      const expressInstance = httpAdapter.getInstance?.();

      if (
        expressInstance &&
        typeof expressInstance === 'object' &&
        'set' in expressInstance &&
        typeof expressInstance.set === 'function'
      ) {
        (
          expressInstance as { set: (key: string, value: boolean) => unknown }
        ).set('trust proxy', true);
      }
    }

    app.use(helmet());

    const allowedOrigins = configService.get<string>(
      'allowedOrigins',
      'http://localhost:9000',
    );
    app.enableCors({
      origin: allowedOrigins.split(','),
      credentials: true,
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    const swaggerConfig = new DocumentBuilder()
      .setTitle('Core Bridge POS API')
      .setDescription(
        'API Gateway for Core Bridge POS - Member Check-in & Access Management',
      )
      .setVersion('1.0')
      .addApiKey(
        {
          type: 'apiKey',
          name: 'X-API-Key',
          in: 'header',
          description: 'API Key for authentication',
        },
        'X-API-Key',
      )
      .addTag('health', 'Health check endpoints')
      .addTag('access', 'Access management endpoints')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);

    const port = configService.get<number>('PORT', 9000);

    await app.listen(port, '0.0.0.0');

    logger.log(
      `Application is running on: http://localhost:${port}`,
      'Bootstrap',
    );
    logger.log(
      `API Documentation: http://localhost:${port}/api/docs`,
      'Bootstrap',
    );
  } catch (error) {
    const message =
      error instanceof Error ? (error.stack ?? error.message) : String(error);
    logger.error('Failed to start application', message, 'Bootstrap');
    process.exit(1);
  }
}

void bootstrap();
