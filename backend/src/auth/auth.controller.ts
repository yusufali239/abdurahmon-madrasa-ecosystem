import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { BotService } from '../bot/bot.service';
import { AppConfig } from '../config/app-config.service';
import { AuthService } from './auth.service';
import { AllowPending, CurrentUser, TelegramGuard } from './guards';
import { serialize } from '../common/serialize';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cfg: AppConfig,
    private readonly botService: BotService,
  ) {}

  /** Текущий пользователь Mini App */
  @Get('me')
  @AllowPending()
  @UseGuards(TelegramGuard)
  async me(@CurrentUser() user: User) {
    return serialize({ ...user, isAdmin: this.cfg.isAdmin(String(user.telegramId)) });
  }

  @Post('admin/exchange')
  async exchange(@Body() body: { token: string }) {
    return { accessToken: await this.auth.exchangeAdminLoginToken(String(body?.token || '')) };
  }

  @Post('admin/telegram')
  telegram(@Body() body: { initData: string }) {
    return { accessToken: this.auth.adminFromInitData(String(body?.initData || '')) };
  }

  @Post('admin/dev')
  dev() {
    return { accessToken: this.auth.devAdminLogin() };
  }

  @Get('config')
  config() {
    return {
      devAuth: this.cfg.allowDevAuth,
      botUsername: this.botService.bot?.isInited() ? this.botService.bot.botInfo.username : this.cfg.botUsername,
      hayriyaMbankNumber: this.cfg.hayriyaMbankNumber,
      hayriyaRecipientName: this.cfg.hayriyaRecipientName,
    };
  }
}
