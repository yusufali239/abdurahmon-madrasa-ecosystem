import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { existsSync } from 'fs';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { BotModule } from './bot/bot.module';
import { AppConfigModule } from './config/config.module';
import { HealthController } from './health.controller';
import { MetaController } from './meta.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { TundukModule } from './tunduk/tunduk.module';
import { UsersModule } from './users/users.module';
import { QueueModule } from './queue/queue.module';
import { SubjectsModule } from './subjects/subjects.module';
import { TeachersModule } from './teachers/teachers.module';
import { LessonsModule } from './lessons/lessons.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { UploadsModule } from './uploads/uploads.module';
import { ContentModule } from './content/content.module';
import { FundModule } from './fund/fund.module';
import { PaymentsModule } from './payments/payments.module';
import { NewsModule } from './news/news.module';
import { AdminModule } from './admin/admin.module';

/**
 * Если фронтенды собраны (npm run build:bundle), backend сам раздаёт их:
 * Mini App — /app, Admin — /admin. Тогда весь проект — один сервис и один домен.
 */
const FRONTENDS = [
  { dir: join(process.cwd(), '..', 'miniapp', 'dist'), route: '/app' },
  { dir: join(process.cwd(), '..', 'admin', 'dist'), route: '/admin' },
].filter((f) => existsSync(join(f.dir, 'index.html')));

@Module({
  imports: [
    ...(FRONTENDS.length
      ? [ServeStaticModule.forRoot(...FRONTENDS.map((f) => ({ rootPath: f.dir, serveRoot: f.route, exclude: ['/api/{*path}'] })))]
      : []),
    AppConfigModule,
    PrismaModule,
    RedisModule,
    QueueModule,
    TundukModule,
    BotModule,
    AuthModule,
    UsersModule,
    SubjectsModule,
    TeachersModule,
    UploadsModule,
    LessonsModule,
    ContentModule,
    FundModule,
    PaymentsModule,
    NewsModule,
    AdminModule,
    SchedulerModule,
  ],
  controllers: [HealthController, MetaController],
})
export class AppModule {}
