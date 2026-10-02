import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { AppConfig } from './config/app-config.service';

// BigInt (telegramId) -> строка в JSON-ответах
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const cfg = app.get(AppConfig);

  app.enableCors({ origin: true, credentials: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: false }));
  app.enableShutdownHooks();

  // Загруженные файлы (чеки, аудио, видео, PDF)
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  await app.listen(cfg.port);
  Logger.log(`API: http://localhost:${cfg.port}/api  (TZ: ${cfg.timezone})`, 'Bootstrap');
}
void bootstrap();
