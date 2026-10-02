import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { BotModule } from './bot/bot.module';
import { AppConfigModule } from './config/config.module';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { TundukModule } from './tunduk/tunduk.module';
import { UsersModule } from './users/users.module';
import { QueueModule } from './queue/queue.module';
import { SubjectsModule } from './subjects/subjects.module';
import { TeachersModule } from './teachers/teachers.module';
import { LessonsModule } from './lessons/lessons.module';
import { SchedulerModule } from './scheduler/scheduler.module';

@Module({
  imports: [
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
    LessonsModule,
    SchedulerModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
