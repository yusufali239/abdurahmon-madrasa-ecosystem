import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { BotModule } from './bot/bot.module';
import { AppConfigModule } from './config/config.module';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { TundukModule } from './tunduk/tunduk.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [AppConfigModule, PrismaModule, RedisModule, TundukModule, BotModule, AuthModule, UsersModule],
  controllers: [HealthController],
})
export class AppModule {}
