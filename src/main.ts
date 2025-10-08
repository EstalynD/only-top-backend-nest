import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Validación global de DTOs según documentación oficial NestJS
  app.useGlobalPipes(
    new ValidationPipe({ 
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      skipMissingProperties: true,  // Permite query params opcionales
      whitelist: true, 
      forbidNonWhitelisted: true,
    }),
  );
  // Habilitar CORS para permitir peticiones desde el frontend (localhost:3040 por defecto)
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN?.split(',') || ['http://localhost:3040'],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  await app.listen(process.env.PORT ?? 3041);
}
bootstrap();
