import { Inject, Injectable, Logger } from '@nestjs/common';
import type { InlineKeyboardMarkup, ReplyKeyboardMarkup, ReplyKeyboardRemove } from 'grammy/types';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS } from '../redis/redis.module';
import { BotService } from './bot.service';

export interface SendOptions {
  reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove;
  /** URL или file_id картинки — тогда отправляется фото с подписью */
  photo?: string;
  disablePreview?: boolean;
}

/**
 * «Чистый чат»: ПЕРЕД каждой отправкой удаляем предыдущее сообщение бота,
 * затем отправляем новое и сохраняем его id в User.last_bot_message_id.
 * Для чатов без пользователя в БД (например, админ ещё не нажал /start) id хранится в Redis.
 */
@Injectable()
export class MessengerService {
  private readonly logger = new Logger('Messenger');
  private readonly locks = new Map<string, Promise<unknown>>();

  constructor(
    private readonly botService: BotService,
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  get enabled() {
    return this.botService.enabled;
  }

  /** Отправить сообщение с удалением предыдущего. Возвращает message_id или null. */
  async send(chatId: number | bigint | string, text: string, opts: SendOptions = {}): Promise<number | null> {
    const api = this.botService.api;
    if (!api) {
      this.logger.debug(`[bot o'chiq] ${chatId}: ${text.slice(0, 80)}`);
      return null;
    }
    const key = String(chatId);
    return this.withLock(key, async () => {
      const lastId = await this.getLastId(key);
      if (lastId) {
        try {
          await api.deleteMessage(key, lastId);
        } catch (e) {
          /* сообщение уже удалено или старше 48 часов */
        }
      }
      try {
        const extra = { parse_mode: 'HTML' as const, reply_markup: opts.reply_markup };
        const msg = opts.photo
          ? await api.sendPhoto(key, opts.photo, { ...extra, caption: text.slice(0, 1024) })
          : await api.sendMessage(key, text, {
              ...extra,
              link_preview_options: { is_disabled: opts.disablePreview ?? true },
            });
        await this.setLastId(key, msg.message_id);
        return msg.message_id;
      } catch (e) {
        if (opts.photo) {
          // Картинка недоступна — отправляем текстом
          return this.sendPlain(key, text, opts);
        }
        this.logger.warn(`Xabar yuborilmadi (${key}): ${(e as Error).message}`);
        return null;
      }
    });
  }

  private async sendPlain(key: string, text: string, opts: SendOptions) {
    try {
      const msg = await this.botService.api!.sendMessage(key, text, {
        parse_mode: 'HTML',
        reply_markup: opts.reply_markup,
        link_preview_options: { is_disabled: true },
      });
      await this.setLastId(key, msg.message_id);
      return msg.message_id;
    } catch (e) {
      this.logger.warn(`Xabar yuborilmadi (${key}): ${(e as Error).message}`);
      return null;
    }
  }

  /** Обновить только клавиатуру последнего сообщения (без нового сообщения) */
  async editMarkup(chatId: number | bigint | string, messageId: number, markup: InlineKeyboardMarkup) {
    await this.botService.api?.editMessageReplyMarkup(String(chatId), messageId, { reply_markup: markup }).catch(() => undefined);
  }

  private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(key) ?? Promise.resolve();
    const run = prev.catch(() => undefined).then(fn);
    this.locks.set(key, run);
    try {
      return await run;
    } finally {
      if (this.locks.get(key) === run) this.locks.delete(key);
    }
  }

  private async getLastId(chatId: string): Promise<number | null> {
    const user = await this.prisma.user.findUnique({
      where: { telegramId: BigInt(chatId) },
      select: { last_bot_message_id: true },
    });
    if (user) return user.last_bot_message_id;
    const v = await this.redis.get(`lastmsg:${chatId}`);
    return v ? Number(v) : null;
  }

  private async setLastId(chatId: string, id: number) {
    const res = await this.prisma.user.updateMany({
      where: { telegramId: BigInt(chatId) },
      data: { last_bot_message_id: id },
    });
    if (res.count === 0) await this.redis.set(`lastmsg:${chatId}`, String(id), 'EX', 60 * 60 * 48);
  }
}
