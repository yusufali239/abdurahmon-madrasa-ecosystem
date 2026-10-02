import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SessionsService } from '../lessons/sessions.service';

/** Все cron-задачи работают в часовом поясе Asia/Bishkek */
@Injectable()
export class LessonCronService {
  private readonly logger = new Logger('Cron');

  constructor(private readonly sessions: SessionsService) {}

  /** 08:00 — спросить учителей: «Bugun darsingiz bo'ladimi?» */
  @Cron('0 8 * * *', { name: 'daily-confirmation', timeZone: 'Asia/Bishkek' })
  async dailyConfirmation() {
    try {
      await this.sessions.runDailyConfirmation();
    } catch (e) {
      this.logger.error(`08:00 cron xatosi: ${(e as Error).stack}`);
    }
  }

  /** Каждые 5 минут — подстраховка напоминаний за 2ч30м (если отложенная задача потерялась) */
  @Cron('*/5 * * * *', { name: 'reminder-safety-net', timeZone: 'Asia/Bishkek' })
  async reminders() {
    try {
      const n = await this.sessions.sendDueReminders();
      if (n) this.logger.log(`${n} ta eslatma yuborildi (zaxira cron)`);
    } catch (e) {
      this.logger.error(`Eslatma cron xatosi: ${(e as Error).message}`);
    }
  }
}
