import { Injectable, OnModuleInit } from '@nestjs/common';
import type { User } from '@prisma/client';
import { InlineKeyboard } from 'grammy';
import { BotService } from '../bot/bot.service';
import { BotContext } from '../bot/bot.types';
import { esc } from '../bot/html';
import { MenuService } from '../bot/menu.service';
import { MessengerService } from '../bot/messenger.service';
import { formatDateUz, weekDayName } from '../common/time.util';
import { PrismaService } from '../prisma/prisma.service';
import { lessonCard } from './lesson-format';
import { LessonsService } from './lessons.service';
import { ATTENDANCE_ICON, ATTENDANCE_UZ, SessionsService } from './sessions.service';

const CANCEL_REASON = 'CANCEL_REASON';

/** Бот: подтверждение уроков, причина отмены, расписание, посещаемость, оценки */
@Injectable()
export class LessonsBot implements OnModuleInit {
  constructor(
    private readonly botService: BotService,
    private readonly messenger: MessengerService,
    private readonly menu: MenuService,
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    private readonly lessons: LessonsService,
  ) {}

  onModuleInit() {
    const f = this.botService.features;

    // Причина отмены обязательна: пока не введена — любые другие действия возвращают к вопросу
    this.botService.onPendingAction(
      CANCEL_REASON,
      (ctx, user, payload) => this.onCancelReason(ctx, user, payload),
      (_ctx, user, payload) => this.askReason(user, payload?.sessionId),
    );

    f.callbackQuery(/^ls:yes:(\d+)$/, async (ctx) => {
      const sessionId = Number(ctx.match![1]);
      try {
        const { notified } = await this.sessions.confirm(sessionId, ctx.dbUser!.id);
        await ctx.answerCallbackQuery({ text: `✅ ${notified} ta talabaga xabar yuborildi` });
        const teacher = await this.prisma.teacher.findUniqueOrThrow({ where: { userId: ctx.dbUser!.id } });
        await this.sessions.askTeacher(teacher.id, `✅ Rahmat! ${notified} ta talabaga «Bugun dars bor» xabari yuborildi.`);
      } catch (e) {
        await ctx.answerCallbackQuery({ text: (e as Error).message, show_alert: true });
      }
    });

    f.callbackQuery(/^ls:no:(\d+)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const sessionId = Number(ctx.match![1]);
      const s = await this.sessions.get(sessionId);
      if (s.lesson.teacher.userId !== ctx.dbUser!.id) return;
      await this.botService.setPending(ctx.dbUser!.id, CANCEL_REASON, { sessionId });
      await this.askReason(ctx.dbUser!, sessionId);
    });

    f.command('bugun', (ctx) => this.showToday(ctx));
    f.callbackQuery('menu:today', async (ctx) => {
      await ctx.answerCallbackQuery();
      await this.showToday(ctx);
    });

    f.callbackQuery('menu:lessons', async (ctx) => {
      await ctx.answerCallbackQuery();
      await this.showMyLessons(ctx);
    });

    f.command('davomat', (ctx) => this.showSessions(ctx));
    f.callbackQuery('menu:attendance', async (ctx) => {
      await ctx.answerCallbackQuery();
      await this.showSessions(ctx);
    });

    f.callbackQuery(/^att:s:(\d+)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      await this.showAttendance(ctx.dbUser!, Number(ctx.match![1]));
    });

    f.callbackQuery(/^att:t:(\d+):(\d+)$/, async (ctx) => {
      const [, sid, stid] = ctx.match!;
      await this.sessions.toggleAttendance(Number(sid), Number(stid), ctx.dbUser!.id);
      await ctx.answerCallbackQuery();
      await this.refreshAttendance(ctx, Number(sid));
    });

    f.callbackQuery(/^att:all:(\d+)$/, async (ctx) => {
      await this.sessions.markAllPresent(Number(ctx.match![1]), ctx.dbUser!.id);
      await ctx.answerCallbackQuery({ text: '✅ Hammasi keldi deb belgilandi' });
      await this.refreshAttendance(ctx, Number(ctx.match![1]));
    });

    f.callbackQuery(/^att:done:(\d+)$/, async (ctx) => {
      const s = await this.sessions.finish(Number(ctx.match![1]), ctx.dbUser!.id);
      await ctx.answerCallbackQuery({ text: '💾 Davomat saqlandi' });
      const next = Math.min(s.pageTo + 1, s.lesson.bookTotalPages);
      const kb = new InlineKeyboard()
        .text(`➡️ Ha, keyingi dars ${next}-betdan`, `adv:${s.lessonId}`)
        .row();
      this.menu.webAppButton(kb, '✏️ Ilovada tahrirlash', `/teacher/lessons/${s.lessonId}`);
      kb.text('⬅️ Bosh menyu', 'menu:home');
      await this.messenger.send(
        ctx.from!.id,
        `💾 <b>Davomat saqlandi.</b>\n\nBugun ${s.pageFrom}–${s.pageTo}-bet o'tildi: «${esc(s.topic)}».\n` +
          `Kitob bo'yicha keyingi darsga o'tamizmi?` +
          (s.lesson.nextTopic ? `\n\nKeyingi mavzu: <b>${esc(s.lesson.nextTopic)}</b>` : ''),
        { reply_markup: kb },
      );
    });

    f.callbackQuery(/^adv:(\d+)$/, async (ctx) => {
      const teacher = await this.prisma.teacher.findUnique({ where: { userId: ctx.dbUser!.id } });
      if (!teacher) return ctx.answerCallbackQuery();
      const l = await this.lessons.advance(Number(ctx.match![1]), {}, teacher.id);
      await ctx.answerCallbackQuery({ text: `📖 Keyingi dars: ${l.currentPageFrom}–${l.currentPageTo}-bet` });
      await this.menu.show(ctx.dbUser!, ctx.isAdmin, `📖 Keyingi dars: <b>${l.currentPageFrom}–${l.currentPageTo}-bet</b>, «${esc(l.topic)}»`);
    });

    f.callbackQuery('menu:grades', async (ctx) => {
      await ctx.answerCallbackQuery();
      await this.showGrades(ctx);
    });
  }

  private async askReason(user: User, sessionId?: number) {
    const s = sessionId ? await this.sessions.get(sessionId).catch(() => null) : null;
    await this.messenger.send(
      user.telegramId,
      `❗️ <b>Darsni bekor qilish sababini yozing</b> (majburiy)\n\n` +
        (s ? `📘 ${esc(s.lesson.subject.name)}, ${s.pageFrom}-bet «${esc(s.topic)}»\n\n` : '') +
        `Sabab talabalarga yuboriladi. Masalan: <i>Betobman</i>, <i>Safardaman</i>.`,
    );
  }

  private async onCancelReason(ctx: BotContext, user: User, payload: any) {
    const reason = ctx.message!.text!.trim();
    if (reason.length < 3) return this.askReason(user, payload?.sessionId);
    const { notified } = await this.sessions.cancel(Number(payload?.sessionId), reason, user.id);
    await this.botService.setPending(user.id, null);
    const teacher = await this.prisma.teacher.findUniqueOrThrow({ where: { userId: user.id } });
    await this.sessions.askTeacher(teacher.id, `❌ Dars bekor qilindi. ${notified} ta talabaga sabab bilan xabar yuborildi.`);
  }

  private async showToday(ctx: BotContext) {
    const user = ctx.dbUser!;
    const now = this.sessions.now();
    const list = await this.menu.todayLessons(user, now.weekDay);
    const kb = new InlineKeyboard();
    const lines = [`📅 <b>${weekDayName(now.weekDay)}, ${formatDateUz(new Date())}</b>`, ''];
    if (!list.length) lines.push('Bugun darslar yo\'q. Dam oling va ilm takrorlang 🤲');
    for (const l of list) {
      const s = await this.sessions.ensureSession(l.id, now);
      const status =
        s.status === 'CANCELLED'
          ? `❌ Bekor qilindi: ${esc(s.cancelReason)}`
          : s.status === 'CONFIRMED'
            ? '✅ Ustoz tasdiqladi'
            : s.status === 'DONE'
              ? '🏁 Yakunlandi'
              : '⏳ Tasdiq kutilmoqda';
      lines.push(lessonCard(l, { startsAt: s.startsAt, pageFrom: s.pageFrom, pageTo: s.pageTo, topic: s.topic }), status, '');
      if (user.role === 'TEACHER' && s.status === 'SCHEDULED') {
        kb.text(`✅ ${l.subject.name}: Ha`, `ls:yes:${s.id}`).text('❌ Yo\'q', `ls:no:${s.id}`).row();
      }
    }
    this.menu.backKeyboard(kb);
    await this.messenger.send(user.telegramId, lines.join('\n'), { reply_markup: kb });
  }

  private async showMyLessons(ctx: BotContext) {
    const user = ctx.dbUser!;
    const list = await this.lessons.list(user, { mine: true });
    const lines = [user.role === 'TEACHER' ? '📚 <b>Mening darslarim</b>' : '📚 <b>Yozilgan darslarim</b>', ''];
    if (!list.length) {
      lines.push(user.role === 'TEACHER' ? 'Hali dars yaratmagansiz. Ilovada «Yangi dars» tugmasini bosing.' : 'Hali hech qaysi darsga yozilmagansiz. Ilovada darslarni ko\'ring.');
    }
    for (const l of list) {
      lines.push(lessonCard(l), `💰 ${l.price ? `${l.price} som/oy` : 'Bepul'} · ${l.paymentType === 'HAYRIYA' ? '🤝 Hayriya' : '💳 MBank'}${l.isContinuous ? ' · ♾ Davomiy' : ''}`, '');
    }
    const kb = new InlineKeyboard();
    this.menu.webAppButton(kb, '📱 Barcha darslar', '/lessons');
    this.menu.backKeyboard(kb);
    await this.messenger.send(user.telegramId, lines.join('\n').slice(0, 4000), { reply_markup: kb });
  }

  private async showSessions(ctx: BotContext) {
    const user = ctx.dbUser!;
    if (user.role !== 'TEACHER') {
      return this.messenger.send(user.telegramId, '⛔️ Davomat faqat ustozlar uchun.', { reply_markup: this.menu.backKeyboard() });
    }
    const sessions = await this.sessions.teacherSessions(user.id);
    const kb = new InlineKeyboard();
    for (const s of sessions) {
      const icon = s.status === 'DONE' ? '🏁' : s.status === 'CANCELLED' ? '❌' : '📝';
      kb.text(`${icon} ${formatDateUz(s.date, 'UTC')} · ${s.lesson.subject.name} (${s.pageFrom}-bet)`, `att:s:${s.id}`).row();
    }
    this.menu.backKeyboard(kb);
    await this.messenger.send(
      user.telegramId,
      sessions.length ? '✅ <b>Davomat</b>\n\nQaysi mashg\'ulot uchun davomat olasiz?' : '✅ <b>Davomat</b>\n\nHozircha mashg\'ulotlar yo\'q.',
      { reply_markup: kb },
    );
  }

  private async attendanceView(sessionId: number) {
    const { session, items } = await this.sessions.attendance(sessionId);
    const kb = new InlineKeyboard();
    for (const i of items) {
      const icon = i.status ? ATTENDANCE_ICON[i.status] : '⬜️';
      const label = i.status ? ATTENDANCE_UZ[i.status] : 'belgilanmagan';
      kb.text(`${icon} ${i.student.fullName} — ${label}`, `att:t:${sessionId}:${i.student.id}`).row();
    }
    if (items.length) kb.text('✅ Qolganlar keldi', `att:all:${sessionId}`).text('💾 Saqlash', `att:done:${sessionId}`).row();
    kb.text('⬅️ Orqaga', 'menu:attendance');
    const present = items.filter((i) => i.status === 'PRESENT' || i.status === 'LATE').length;
    const text =
      `✅ <b>Davomat — ${esc(session.lesson.subject.name)}</b>\n` +
      `🗓 ${formatDateUz(session.date, 'UTC')} · 📖 ${session.pageFrom}–${session.pageTo}-bet «${esc(session.topic)}»\n\n` +
      (items.length
        ? `Keldi: <b>${present}/${items.length}</b>\nTalaba nomini bosib holatini almashtiring: ✅ → ❌ → ⏰ → 📝`
        : 'Bu darsga hali talabalar yozilmagan.');
    return { text, kb };
  }

  private async showAttendance(user: User, sessionId: number) {
    const s = await this.sessions.get(sessionId);
    if (s.lesson.teacher.userId !== user.id) return;
    const { text, kb } = await this.attendanceView(sessionId);
    await this.messenger.send(user.telegramId, text, { reply_markup: kb });
  }

  /** Переключение статусов редактирует текущее сообщение (без новых сообщений) */
  private async refreshAttendance(ctx: BotContext, sessionId: number) {
    const { text, kb } = await this.attendanceView(sessionId);
    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb }).catch(() => undefined);
  }

  private async showGrades(ctx: BotContext) {
    const user = ctx.dbUser!;
    const stats = await this.sessions.studentStats(user.id);
    const lines = ['📊 <b>Baholarim va davomatim</b>', ''];
    lines.push(
      `📈 O'rtacha baho: <b>${stats.averageScore ?? '—'}</b>`,
      `✅ Davomat: <b>${stats.attendance.percent ?? '—'}${stats.attendance.percent !== null ? '%' : ''}</b> (${stats.attendance.total} ta mashg'ulot)`,
      '',
    );
    for (const g of stats.grades.slice(0, 10)) {
      lines.push(`• ${formatDateUz(g.createdAt)} — ${esc(g.lesson.subject.name)}: <b>${g.score}</b> ${'⭐️'.repeat(g.score)}${g.comment ? `\n   💬 ${esc(g.comment)}` : ''}`);
    }
    if (!stats.grades.length) lines.push('Hali baholar yo\'q.');
    await this.messenger.send(user.telegramId, lines.join('\n'), { reply_markup: this.menu.backKeyboard() });
  }
}
