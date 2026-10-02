import { Injectable } from '@nestjs/common';
import type { InlineKeyboard } from 'grammy';
import { AppConfig } from '../config/app-config.service';
import { MessengerService } from './messenger.service';

/** Уведомления всем администраторам из ADMIN_IDS */
@Injectable()
export class AdminNotifier {
  constructor(
    private readonly cfg: AppConfig,
    private readonly messenger: MessengerService,
  ) {}

  async notify(text: string, kb?: InlineKeyboard) {
    for (const id of this.cfg.adminIds) {
      await this.messenger.send(id, text, { reply_markup: kb });
    }
  }
}
