import { Body, Controller, ForbiddenException, Headers, HttpCode, Post } from '@nestjs/common';
import { AppConfig } from '../config/app-config.service';
import { BotService } from './bot.service';

/** Webhook Telegram (используется, если задан BOT_WEBHOOK_URL) */
@Controller('bot')
export class BotWebhookController {
  constructor(
    private readonly botService: BotService,
    private readonly cfg: AppConfig,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(@Body() update: any, @Headers('x-telegram-bot-api-secret-token') secret?: string) {
    if (!this.botService.bot || secret !== this.cfg.botWebhookSecret) throw new ForbiddenException();
    // Не ждём завершения обработки, чтобы Telegram не повторял запрос
    void this.botService.bot.handleUpdate(update).catch(() => undefined);
    return { ok: true };
  }
}
