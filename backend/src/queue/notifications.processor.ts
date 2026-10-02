import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MessengerService } from '../bot/messenger.service';
import { SessionsService } from '../lessons/sessions.service';
import { MessageJob, NOTIFICATIONS_QUEUE, ReminderJob } from './queue.constants';

/** Обработчик очереди уведомлений. Лимит ~25 сообщений/сек (ограничение Telegram — 30). */
@Processor(NOTIFICATIONS_QUEUE, { concurrency: 5, limiter: { max: 25, duration: 1000 } })
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger('Queue');

  constructor(
    private readonly messenger: MessengerService,
    private readonly sessions: SessionsService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case 'message': {
        const d = job.data as MessageJob;
        return this.messenger.send(d.chatId, d.text, { photo: d.photo, reply_markup: d.reply_markup });
      }
      case 'reminder':
        return this.sessions.sendReminder((job.data as ReminderJob).sessionId);
      default:
        this.logger.warn(`Noma'lum vazifa: ${job.name}`);
    }
  }
}
