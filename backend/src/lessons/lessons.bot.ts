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
import { lessonCard, pageTopicLine } from './lesson-format';
import { LessonsService } from './lessons.service';
import { ATTENDANCE_ICON, ATTENDANCE_UZ, SessionsService } from './sessions.service';

const CANCEL_REASON = 'CANCEL_REASON';
const START_PAGE = 'START_PAGE';
const FINISH_PAGE = 'FINISH_PAGE';
const FINISH_TOPIC = 'FINISH_TOPIC';

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

    // 💾 Davomat: сохранить; если урок ещё не закончен — предложить ⏹ Yakunlash
    f.callbackQuery(/^att:done:(\d+)$/, async (ctx) => {
      const s = await this.sessions.finalizeAttendance(Number(ctx.match![1]), ctx.dbUser!.id);
      await ctx.answerCallbackQuery({ text: '💾 Davomat saqlandi' });
      if (s.status === 'DONE') return this.menu.show(ctx.dbUser!, ctx.isAdmin, '💾 Davomat saqlandi.');
      await this.askFinishPage(ctx.dbUser!, s.id);
    });

    // ▶ Darsni boshlash
    f.callbackQuery(/^ls:start:(\d+)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const s = await this.sessions.get(Number(ctx.match![1]));
      if (s.lesson.teacher.userId !== ctx.dbUser!.id) return;
      const page = s.pageFrom ?? s.lesson.currentPage;
      if (!page) {
        // Продолжающаяся книга: страница начала неизвестна — спрашиваем
        await this.botService.setPending(ctx.dbUser!.id, START_PAGE, { sessionId: s.id });
        return this.messenger.send(
          ctx.from.id,
          `▶️ <b>${esc(s.lesson.subject.name)}</b> — «${esc(s.lesson.bookTitle)}»\n\nBugun <b>qaysi betdan</b> boshlaysiz? Raqam yozing, masalan: <code>28</code>`,
          { reply_markup: new InlineKeyboard().text('⬅️ Bekor qilish', `pend:cancel`) },
        );
      }
      await this.startAndShow(ctx.dbUser!, s.id, {});
    });
    this.botService.onPendingAction(START_PAGE, async (ctx, user, payload) => {
      const page = parseInt(ctx.message!.text!.replace(/\D/g, ''), 10);
      if (!page) return void (await this.messenger.send(user.telegramId, '⚠️ Bet raqamini yozing, masalan: <code>28</code>'));
      await this.botService.setPending(user.id, null);
      await this.startAndShow(user, Number(payload?.sessionId), { pageFrom: page });
    });

    // ⏹ Yakunlash: до какой страницы + следующая тема
    f.callbackQuery(/^ls:finish:(\d+)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const s = await this.sessions.get(Number(ctx.match![1]));
      if (s.lesson.teacher.userId !== ctx.dbUser!.id) return;
      await this.askFinishPage(ctx.dbUser!, s.id);
    });
    this.botService.onPendingAction(FINISH_PAGE, async (ctx, user, payload) => {
      const pageTo = parseInt(ctx.message!.text!.replace(/\D/g, ''), 10);
      if (!pageTo) return void (await this.messenger.send(user.telegramId, '⚠️ Bet raqamini yozing, masalan: <code>28</code>'));
      await this.botService.setPending(user.id, FINISH_TOPIC, { sessionId: payload?.sessionId, pageTo });
      await this.messenger.send(
        user.telegramId,
        `📝 <b>Keyingi darsning mavzusi?</b>\n\nMasalan: <i>Savdo odoblari</i>`,
        { reply_markup: new InlineKeyboard().text('➖ Mavzusiz saqlash', 'fin:skip') },
      );
    });
    this.botService.onPendingAction(FINISH_TOPIC, (ctx, user, payload) => this.finishLesson(user, payload, ctx.message!.text!.trim()));
    f.callbackQuery('fin:skip', async (ctx) => {
      await ctx.answerCallbackQuery();
      const user = ctx.dbUser!;
      if (user.pendingAction !== FINISH_TOPIC) return;
      await this.finishLesson(user, user.pendingPayload, undefined);
    });
    f.callbackQuery('pend:cancel', async (ctx) => {
      await ctx.answerCallbackQuery();
      await this.botService.setPending(ctx.dbUser!.id, null);
      await this.menu.show(ctx.dbUser!, ctx.isAdmin);
    });

    f.callbackQuery('menu:grades', async (ctx) => {
      await ctx.answerCallbackQuery();
      await this.showGrades(ctx);
    });
  }

  private async startAndShow(user: User, sessionId: number, dto: { pageFrom?: number }) {
    try {
      const s = await this.sessions.start(sessionId, dto, user.id);
      const kb = new InlineKeyboard().text('✅ Davomat', `att:s:${s.id}`).text('⏹ Yakunlash', `ls:finish:${s.id}`).row().text('⬅️ Bosh menyu', 'menu:home');
      await this.messenger.send(
        user.telegramId,
        `▶️ <b>Dars boshlandi</b>\n\n📘 ${esc(s.lesson.subject.name)} — «${esc(s.lesson.bookTitle)}»\n📖 ${pageTopicLine(s.pageFrom, s.topic)}\n\nDars tugagach <b>⏹ Yakunlash</b> ni bosing.`,
        { reply_markup: kb },
      );
    } catch (e) {
      await this.messenger.send(user.telegramId, `⚠️ ${esc((e as Error).message)}`, { reply_markup: this.menu.backKeyboard() });
    }
  }

  private async askFinishPage(user: User, sessionId: number) {
    const s = await this.sessions.get(sessionId);
    await this.botService.setPending(user.id, FINISH_PAGE, { sessionId });
    await this.messenger.send(
      user.telegramId,
      `⏹ <b>Darsni yakunlash</b> — ${esc(s.lesson.subject.name)}\n` +
        (s.pageFrom ? `Bugun ${s.pageFrom}-betdan boshlandi.\n` : '') +
        `\n<b>Qaysi betgacha</b> o'qildi? Raqam yozing, masalan: <code>28</code>`,
      { reply_markup: new InlineKeyboard().text('⬅️ Keyinroq', 'pend:cancel') },
    );
  }

  private async finishLesson(user: User, payload: any, nextTopic: string | undefined) {
    await this.botService.setPending(user.id, null);
    try {
      const s = await this.sessions.finish(Number(payload?.sessionId), { pageTo: Number(payload?.pageTo), nextTopic }, user.id);
      await this.menu.show(
        user,
        false,
        `🏁 <b>Dars yakunlandi.</b> ${s.pageFrom}–${s.pageTo}-bet o'qildi.\n📖 Keyingi dars: <b>${Math.min((s.pageTo ?? 0) + 1, s.lesson.bookTotalPages)}-betdan</b>${nextTopic ? ` · ${esc(nextTopic)}` : ''}`,
      );
    } catch (e) {
      await this.messenger.send(user.telegramId, `⚠️ ${esc((e as Error).message)}`, { reply_markup: this.menu.backKeyboard() });
    }
  }

  private async askReason(user: User, sessionId?: number) {
    const s = sessionId ? await this.sessions.get(sessionId).catch(() => null) : null;
    await this.messenger.send(
      user.telegramId,
      `❗️ <b>Darsni bekor qilish sababini yozing</b> (majburiy)\n\n` +
        (s ? `📘 ${esc(s.lesson.subject.name)}${s.pageFrom || s.topic ? `, ${pageTopicLine(s.pageFrom, s.topic)}` : ''}\n\n` : '') +
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
            : s.status === 'STARTED'
              ? '▶️ Dars ketmoqda'
              : s.status === 'DONE'
                ? `🏁 Yakunlandi: ${s.pageFrom}–${s.pageTo}-bet`
                : '⏳ Tasdiq kutilmoqda';
      lines.push(lessonCard(l, { startsAt: s.startsAt, page: s.pageFrom, topic: s.topic }), status, '');
      if (user.role === 'TEACHER') {
        if (s.status === 'SCHEDULED') kb.text(`✅ ${l.subject.name}: Ha`, `ls:yes:${s.id}`).text('❌ Yo\'q', `ls:no:${s.id}`).row();
        if (s.status === 'SCHEDULED' || s.status === 'CONFIRMED') kb.text(`▶️ ${l.subject.name}: boshlash`, `ls:start:${s.id}`).row();
        if (s.status === 'STARTED') kb.text(`⏹ ${l.subject.name}: yakunlash`, `ls:finish:${s.id}`).row();
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
      lines.push(lessonCard(l), `💰 ${l.price ? `${l.price} som / dars` : 'Bepul'}`, '');
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
      kb.text(`${icon} ${formatDateUz(s.date, 'UTC')} · ${s.lesson.subject.name}${s.pageFrom ? ` (${s.pageFrom}-bet)` : ''}`, `att:s:${s.id}`).row();
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
      `🗓 ${formatDateUz(session.date, 'UTC')}${session.pageFrom || session.topic ? ` · 📖 ${pageTopicLine(session.pageFrom, session.topic)}` : ''}\n\n` +
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
