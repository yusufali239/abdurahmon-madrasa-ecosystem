import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, PaymentType, Prisma, User } from '@prisma/client';
import { InlineKeyboard } from 'grammy';
import { AdminNotifier } from '../bot/admin-notifier.service';
import { esc } from '../bot/html';
import { MenuService } from '../bot/menu.service';
import { MessengerService } from '../bot/messenger.service';
import { effectivePrice } from '../common/pricing';
import { currentPeriod, formatSom } from '../common/time.util';
import { AppConfig } from '../config/app-config.service';
import { FundService } from '../fund/fund.service';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';

const PAYMENT_INCLUDE = {
  student: { select: { id: true, fullName: true, phone: true, telegramId: true } },
  teacher: { include: { user: { select: { fullName: true, telegramId: true } } } },
  lesson: { include: { subject: true } },
  donation: true,
} satisfies Prisma.PaymentInclude;

export type PaymentActor = { kind: 'admin'; telegramId: string } | { kind: 'teacher'; userId: number };

/**
 * Платежи:
 *  - MBANK_SELF — студент платит напрямую учителю (mbankNumber учителя);
 *  - HAYRIYA — деньги идут на HAYRIYA_MBANK_NUMBER, создаётся Donation, при подтверждении
 *    увеличивается DonationFund.personalTotal учителя.
 * Статус: PENDING -> CONFIRMED (админ или учитель для MBANK_SELF) / REJECTED.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: AppConfig,
    private readonly fund: FundService,
    private readonly admins: AdminNotifier,
    private readonly messenger: MessengerService,
    private readonly menu: MenuService,
    private readonly uploads: UploadsService,
  ) {}

  /** Реквизиты для оплаты урока: сумма, номер MBank, период */
  async info(user: User, lessonId: number) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { teacher: { include: { user: { select: { fullName: true } } } }, subject: true },
    });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    const period = currentPeriod(this.cfg.timezone);
    const existing = await this.prisma.payment.findFirst({
      where: { studentId: user.id, lessonId, period, status: { in: ['PENDING', 'CONFIRMED'] } },
    });
    const isHayriya = lesson.paymentType === 'HAYRIYA';
    return {
      lessonId,
      subject: lesson.subject.name,
      teacherName: lesson.teacher.user.fullName,
      amount: effectivePrice(lesson),
      priceTier: lesson.priceTier,
      customPrice: lesson.customPrice,
      paymentType: lesson.paymentType,
      period,
      recipient: isHayriya
        ? { name: this.cfg.hayriyaRecipientName, mbankNumber: this.cfg.hayriyaMbankNumber }
        : { name: lesson.teacher.user.fullName, mbankNumber: lesson.teacher.mbankNumber },
      existing,
    };
  }

  async createForLesson(user: User, lessonId: number, receipt?: Express.Multer.File, note?: string) {
    const info = await this.info(user, lessonId);
    if (info.amount <= 0) throw new BadRequestException('Bu dars bepul');
    if (info.existing) {
      throw new BadRequestException(info.existing.status === 'CONFIRMED' ? 'Bu oy uchun to\'lov tasdiqlangan' : 'To\'lovingiz tekshirilmoqda');
    }
    const lesson = await this.prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } });
    // Оплата подразумевает запись на урок
    await this.prisma.enrollment.upsert({
      where: { lessonId_studentId: { lessonId, studentId: user.id } },
      update: { status: 'ACTIVE' },
      create: { lessonId, studentId: user.id },
    });
    const receiptUrl = receipt ? (await this.uploads.save(receipt, 'receipts')).url : null;
    return this.createPayment({
      studentId: user.id,
      teacherId: lesson.teacherId,
      lessonId,
      amount: info.amount,
      paymentType: lesson.paymentType,
      receiptUrl,
      period: info.period,
      note,
    });
  }

  /** Добровольное пожертвование в фонд (засчитывается выбранному учителю) */
  async createDonation(user: User, teacherId: number, amount: number, receipt?: Express.Multer.File, note?: string) {
    if (!Number.isInteger(amount) || amount < 10) throw new BadRequestException('Summa kamida 10 som bo\'lsin');
    const teacher = await this.prisma.teacher.findUnique({ where: { id: teacherId } });
    if (!teacher) throw new NotFoundException('Ustoz topilmadi');
    const receiptUrl = receipt ? (await this.uploads.save(receipt, 'receipts')).url : null;
    return this.createPayment({
      studentId: user.id,
      teacherId,
      lessonId: null,
      amount,
      paymentType: 'HAYRIYA',
      receiptUrl,
      period: currentPeriod(this.cfg.timezone),
      note,
    });
  }

  private async createPayment(d: {
    studentId: number;
    teacherId: number;
    lessonId: number | null;
    amount: number;
    paymentType: PaymentType;
    receiptUrl: string | null;
    period: string;
    note?: string;
  }) {
    const payment = await this.prisma.payment.create({
      data: {
        studentId: d.studentId,
        teacherId: d.teacherId,
        lessonId: d.lessonId,
        amount: d.amount,
        paymentType: d.paymentType,
        receipt_url: d.receiptUrl,
        period: d.period,
        note: d.note,
        donation:
          d.paymentType === 'HAYRIYA'
            ? { create: { teacherId: d.teacherId, studentId: d.studentId, amount: d.amount, receipt_url: d.receiptUrl } }
            : undefined,
      },
      include: PAYMENT_INCLUDE,
    });
    await this.notifyNew(payment);
    return payment;
  }

  private paymentText(p: Prisma.PaymentGetPayload<{ include: typeof PAYMENT_INCLUDE }>) {
    return (
      `👤 ${esc(p.student.fullName)} (${esc(p.student.phone)})\n` +
      (p.lesson ? `📘 ${esc(p.lesson.subject.name)} — ${esc(p.teacher.user.fullName)}\n` : `🤝 Hayriya — ${esc(p.teacher.user.fullName)} hissasiga\n`) +
      `💰 <b>${formatSom(p.amount)}</b> · ${p.paymentType === 'HAYRIYA' ? '🤝 Hayriya' : '💳 MBank (ustozga)'}` +
      (p.period ? ` · ${p.period}` : '')
    );
  }

  private async notifyNew(p: Prisma.PaymentGetPayload<{ include: typeof PAYMENT_INCLUDE }>) {
    const kb = new InlineKeyboard().text('✅ Tasdiqlash', `pay:ok:${p.id}`).text('❌ Rad etish', `pay:no:${p.id}`);
    const receipt = this.uploads.absolute(p.receipt_url);
    const text = `🧾 <b>Yangi to'lov #${p.id}</b>\n\n${this.paymentText(p)}${receipt ? `\n📎 Chek: ${esc(receipt)}` : '\n📎 Chek yuklanmagan'}`;
    await this.admins.notify(text, kb);
    if (p.paymentType === 'MBANK_SELF') {
      await this.messenger.send(p.teacher.user.telegramId, `${text}\n\nMBank hisobingizga tushganini tekshirib, tasdiqlang.`, { reply_markup: kb });
    }
  }

  private async load(id: number) {
    const p = await this.prisma.payment.findUnique({ where: { id }, include: PAYMENT_INCLUDE });
    if (!p) throw new NotFoundException('To\'lov topilmadi');
    return p;
  }

  private async assertActor(p: Awaited<ReturnType<PaymentsService['load']>>, actor: PaymentActor) {
    if (actor.kind === 'admin') {
      if (!this.cfg.isAdmin(actor.telegramId)) throw new ForbiddenException();
      return;
    }
    // Учитель подтверждает только прямые MBank-платежи себе
    if (p.paymentType !== 'MBANK_SELF' || p.teacher.userId !== actor.userId) {
      throw new ForbiddenException('Bu to\'lovni faqat admin tasdiqlaydi');
    }
  }

  async confirm(id: number, actor: PaymentActor) {
    const p = await this.load(id);
    await this.assertActor(p, actor);
    if (p.status === 'CONFIRMED') return p;
    const before = await this.fund.globalTotal();
    const confirmedBy = actor.kind === 'teacher' ? actor.userId : null;
    await this.prisma.$transaction(async (tx) => {
      const res = await tx.payment.updateMany({
        where: { id, status: { not: 'CONFIRMED' } },
        data: { status: 'CONFIRMED', confirmedAt: new Date(), confirmedBy },
      });
      if (!res.count) return;
      if (p.donation) {
        await tx.donation.update({ where: { id: p.donation.id }, data: { status: 'CONFIRMED', confirmedAt: new Date() } });
        // DonationFund.personalTotal += amount
        await tx.donationFund.upsert({
          where: { teacherId: p.teacherId },
          update: { personalTotal: { increment: p.donation.amount } },
          create: { teacherId: p.teacherId, personalTotal: p.donation.amount },
        });
      }
    });
    if (p.donation) await this.fund.checkLimitCrossed(before);
    const kb = new InlineKeyboard();
    if (p.lessonId) this.menu.webAppButton(kb, '📚 Dars materiallari', `/lessons/${p.lessonId}`);
    kb.text('⬅️ Bosh menyu', 'menu:home');
    await this.messenger.send(
      p.student.telegramId,
      `✅ <b>To'lovingiz tasdiqlandi!</b>\n\n${this.paymentText(p)}` +
        (p.paymentType === 'HAYRIYA' ? '\n\n🤲 Alloh savobingizni ziyoda qilsin! Hayriya jamg\'armasiga qo\'shildi.' : '\n\nEndi barcha dars materiallari ochiq.'),
      { reply_markup: kb },
    );
    return this.load(id);
  }

  async reject(id: number, actor: PaymentActor, reason?: string) {
    const p = await this.load(id);
    await this.assertActor(p, actor);
    if (p.status === 'CONFIRMED') throw new BadRequestException('Tasdiqlangan to\'lovni rad etib bo\'lmaydi');
    await this.prisma.payment.update({ where: { id }, data: { status: 'REJECTED', note: reason ?? p.note } });
    if (p.donation) await this.prisma.donation.update({ where: { id: p.donation.id }, data: { status: 'REJECTED' } });
    await this.messenger.send(
      p.student.telegramId,
      `❌ <b>To'lov rad etildi</b>\n\n${this.paymentText(p)}${reason ? `\nSabab: ${esc(reason)}` : ''}\n\nChekni tekshirib, qayta yuboring.`,
      { reply_markup: new InlineKeyboard().text('⬅️ Bosh menyu', 'menu:home') },
    );
    return this.load(id);
  }

  async list(filter: { status?: PaymentStatus; paymentType?: PaymentType; teacherId?: number; studentId?: number }) {
    const rows = await this.prisma.payment.findMany({
      where: filter,
      include: PAYMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    return rows.map((r) => ({ ...r, receipt_url: this.uploads.absolute(r.receipt_url) }));
  }

  mine(user: User) {
    return this.list({ studentId: user.id });
  }

  async forTeacher(userId: number) {
    const t = await this.prisma.teacher.findUnique({ where: { userId } });
    if (!t) throw new ForbiddenException();
    return this.list({ teacherId: t.id });
  }
}
