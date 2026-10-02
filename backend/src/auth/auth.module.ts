import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppConfig } from '../config/app-config.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AdminGuard, TelegramGuard } from './guards';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [AppConfig],
      useFactory: (cfg: AppConfig) => ({ secret: cfg.jwtSecret }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TelegramGuard, AdminGuard],
  exports: [AuthService, TelegramGuard, AdminGuard, JwtModule],
})
export class AuthModule {}
