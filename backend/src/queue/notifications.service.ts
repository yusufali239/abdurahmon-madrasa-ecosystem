import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { MessageJob, NOTIFICATIONS_QUEUE } from './queue.constants';

/**
 * Постановка уведомлений в очередь BullMQ.
 * Массовые рассылки идут через очередь с лимитом (~25 сообщений/сек — ограничение Telegram).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');

  constructor(@InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue) {}

  async sendMany(chatIds: Array<bigint | string | number>, text: string, extra: Omit<MessageJob, 'chatId' | 'text'> = {}) {
    if (!chatIds.length) return 0;
    const reply_markup = extra.reply_markup ? JSON.parse(JSON.stringify(extra.reply_markup)) : undefined;
    await this.queue.addBulk(
      chatIds.map((id) => ({
        name: 'message',
        data: { chatId: String(id), text, photo: extra.photo, reply_markup } satisfies MessageJob,
        opts: { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 1000, removeOnFail: 1000 },
      })),
    );
    return chatIds.length;
  }

  /** Отложенное напоминание (за 2 ч 30 мин до урока). jobId защищает от дублей. */
  async scheduleReminder(sessionId: number, at: Date) {
    const jobId = `reminder-${sessionId}`;
    const existing = await this.queue.getJob(jobId);
    if (existing) await existing.remove().catch(() => undefined);
    const delay = Math.max(0, at.getTime() - Date.now());
    await this.queue.add('reminder', { sessionId }, { jobId, delay, attempts: 3, removeOnComplete: true, removeOnFail: 100 });
    this.logger.log(`Eslatma #${sessionId}: ${Math.round(delay / 60000)} daqiqadan so'ng`);
  }

  async broadcastNews(newsId: number) {
    await this.queue.add('broadcast-news', { newsId }, { attempts: 2, removeOnComplete: true });
  }
}
