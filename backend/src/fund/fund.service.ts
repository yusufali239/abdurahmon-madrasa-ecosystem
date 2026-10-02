import { Injectable } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { AdminNotifier } from '../bot/admin-notifier.service';
import { esc } from '../bot/html';
import { formatSom } from '../common/time.util';
import { AppConfig } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../queue/notifications.service';

export interface ReportInput {
  video_url: string;
  description: string;
  spentAmount: number;
}

/**
 * Благотворительный фонд «Hayriya jamg'armasi».
 * personalTotal — вклад по учителю; GlobalTotal = sum(personalTotal).
 * Остаток = GlobalTotal − сумма распределённого по отчётам.
 */
@Injectable()
export class FundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: AppConfig,
    private readonly admins: AdminNotifier,
    private readonly notifications: NotificationsService,
  ) {}

  async limit(): Promise<number> {
    const s = await this.prisma.appSetting.findUnique({ where: { key: 'DONATION_LIMIT' } });
    const v = Number(s?.value);
    return Number.isFinite(v) && v > 0 ? v : this.cfg.donationLimitDefault;
  }

  async setLimit(limit: number) {
    await this.prisma.appSetting.upsert({
      where: { key: 'DONATION_LIMIT' },
      update: { value: String(limit) },
      create: { key: 'DONATION_LIMIT', value: String(limit) },
    });
    return this.summary();
  }

  /** Общий фонд = доли учителей (хайрия за уроки) + анонимные хайрии учеников */
  async globalTotal(): Promise<number> {
    const [funds, anon] = await Promise.all([
      this.prisma.donationFund.aggregate({ _sum: { personalTotal: true } }),
      this.prisma.donation.aggregate({ where: { teacherId: null, status: 'CONFIRMED' }, _sum: { amount: true } }),
    ]);
    return (funds._sum.personalTotal ?? 0) + (anon._sum.amount ?? 0);
  }

  async summary(teacherId?: number) {
    const [global, spent, limit, personal, reportsCount, pending] = await Promise.all([
      this.globalTotal(),
      this.prisma.donationReport.aggregate({ _sum: { spentAmount: true } }),
      this.limit(),
      teacherId ? this.prisma.donationFund.findUnique({ where: { teacherId } }) : null,
      this.prisma.donationReport.count(),
      this.prisma.donation.aggregate({ where: { status: 'PENDING' }, _sum: { amount: true }, _count: true }),
    ]);
    const distributed = spent._sum.spentAmount ?? 0;
    const available = global - distributed;
    return {
      personalTotal: teacherId ? (personal?.personalTotal ?? 0) : null,
      globalTotal: global,
      distributed,
      available,
      limit,
      progressPercent: Math.min(100, Math.round((available / limit) * 100)),
      limitReached: available >= limit,
      reportsCount,
      pendingAmount: pending._sum.amount ?? 0,
      pendingCount: pending._count,
      hayriyaMbankNumber: this.cfg.hayriyaMbankNumber,
      recipientName: this.cfg.hayriyaRecipientName,
    };
  }

  teachersBreakdown() {
    return this.prisma.donationFund.findMany({
      include: { teacher: { include: { user: { select: { fullName: true } } } } },
      orderBy: { personalTotal: 'desc' },
    });
  }

  reports() {
    return this.prisma.donationReport.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createReport(dto: ReportInput) {
    const report = await this.prisma.donationReport.create({ data: dto });
    // Учителя получают уведомление о новом отчёте
    const teachers = await this.prisma.user.findMany({
      where: { role: 'TEACHER', status: 'APPROVED' },
      select: { telegramId: true },
    });
    await this.notifications.sendMany(
      teachers.map((t) => t.telegramId),
      `🤝 <b>Hayriya jamg'armasi — yangi hisobot</b>\n\n${esc(dto.description)}\n\nSarflandi: <b>${formatSom(dto.spentAmount)}</b>\nJazakumulloh xoyron! 🤲`,
      { reply_markup: new InlineKeyboard().text('📹 Hisobotlarni ko\'rish', 'fund:reports').text('⬅️ Bosh menyu', 'menu:home') },
    );
    return report;
  }

  deleteReport(id: number) {
    return this.prisma.donationReport.delete({ where: { id } });
  }

  /** Вызывается после подтверждения пожертвования: уведомить админов о достижении лимита */
  async checkLimitCrossed(before: number) {
    const s = await this.summary();
    const prevAvailable = before - s.distributed;
    if (prevAvailable < s.limit && s.available >= s.limit) {
      await this.admins.notify(
        `🎯 <b>Hayriya jamg'armasi limitga yetdi!</b>\n\nQoldiq: <b>${formatSom(s.available)}</b> (limit ${formatSom(s.limit)})\n` +
          `Mablag'ni tarqatib, admin panelda video-hisobot yuklang.`,
      );
    }
  }
}
