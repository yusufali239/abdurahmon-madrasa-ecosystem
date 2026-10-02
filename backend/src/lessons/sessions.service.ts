import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AttendanceStatus, Prisma } from '@prisma/client';
import { InlineKeyboard } from 'grammy';
import { esc, isTelegramSafeUrl } from '../bot/html';
import { MenuService } from '../bot/menu.service';
import { MessengerService } from '../bot/messenger.service';
import { resolveStartsAt } from '../common/lesson-time';
import { dateOnly, formatHHmm, weekDayName, ZonedParts, zonedParts } from '../common/time.util';
import { AppConfig } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../queue/notifications.service';
import { lessonCard, pageTopicLine } from './lesson-format';
import { LessonsService } from './lessons.service';

/** Напоминание за 2 часа 30 минут до начала */
export const REMINDER_BEFORE_MS = (2 * 60 + 30) * 60 * 1000;

const SESSION_INCLUDE = {
  lesson: {
    include: {
      subject: true,
      location: true,
      teacher: { include: { user: true } },
    },
  },
} satisfies Prisma.LessonSessionInclude;

export type SessionFull = Prisma.LessonSessionGetPayload<{ include: typeof SESSION_INCLUDE }>;

export const ATTENDANCE_ICON: Record<AttendanceStatus, string> = {
  PRESENT: '✅',
  ABSENT: '❌',
  LATE: '⏰',
  EXCUSED: '📝',
};
export const ATTENDANCE_UZ: Record<AttendanceStatus, string> = {
  PRESENT: 'Keldi',
  ABSENT: 'Kelmadi',
  LATE: 'Kechikdi',
  EXCUSED: 'Sababli',
};

/**
 * Занятия на конкретную дату: ежедневное подтверждение учителем (08:00),
 * отмена с причиной, напоминания студентам, посещаемость.
 */
@Injectable()
export class SessionsService {
  private readonly logger = new Logger('Sessions');

  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: AppConfig,
    private readonly messenger: MessengerService,
    private readonly menu: MenuService,
    private readonly notifications: NotificationsService,
    private readonly lessons: LessonsService,
  ) {}

  now(): ZonedParts {
    return zonedParts(new Date(), this.cfg.timezone);
  }

  /** Создать (или получить) занятие урока на дату — снимок страниц и темы */
  async ensureSession(lessonId: number, day: ZonedParts = this.now()) {
    const lesson = await this.prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } });
    const date = dateOnly(day);
    const startsAt = resolveStartsAt(lesson, day, this.cfg.timezone);
    return this.prisma.lessonSession.upsert({
      where: { lessonId_date: { lessonId, date } },
      update: {},
      create: {
        lessonId,
        date,
        startsAt,
        // Страница начала известна заранее (новая книга / после прошлого урока) или спросим при старте
        pageFrom: lesson.currentPage,
        topic: lesson.topic,
      },
      include: SESSION_INCLUDE,
    });
  }

  async get(id: number): Promise<SessionFull> {
    const s = await this.prisma.lessonSession.findUnique({ where: { id }, include: SESSION_INCLUDE });
    if (!s) throw new NotFoundException('Mashg\'ulot topilmadi');
    return s;
  }

  /**
   * CRON 08:00 (Asia/Bishkek): непрерывные уроки на сегодня -> вопрос учителю «Ha / Yo'q»,
   * планирование напоминаний.
   */
  async runDailyConfirmation(opts: { catchUp?: boolean } = {}) {
    const today = this.now();
    const lessons = await this.prisma.lesson.findMany({
      where: { isContinuous: true, isActive: true, weekDays: { has: today.weekDay } },
      select: { id: true, teacherId: true },
    });
    const teacherIds = new Set<number>();
    for (const l of lessons) {
      const session = await this.ensureSession(l.id, today);
      // Не спрашиваем про урок, который уже начался по времени
      const notStarted = !session.startsAt || session.startsAt.getTime() > Date.now();
      if (session.status === 'SCHEDULED' && !session.askedAt && notStarted) teacherIds.add(l.teacherId);
      await this.scheduleReminder(session);
    }
    for (const teacherId of teacherIds) await this.askTeacher(teacherId);
    if (!opts.catchUp || teacherIds.size) {
      this.logger.log(`${opts.catchUp ? 'Qo\'shimcha tekshiruv' : '08:00'} — ${lessons.length} ta dars, ${teacherIds.size} ta ustozga so'rov yuborildi`);
    }
    return { lessons: lessons.length, teachers: teacherIds.size };
  }

  /**
   * Подстраховка (каждые 5 минут после 08:00): если сервер перезапускался после 08:00
   * или урок на сегодня создан позже — учитель всё равно получит вопрос «Ha / Yo'q».
   */
  async catchUpToday() {
    if (this.now().hour < 8) return { lessons: 0, teachers: 0 };
    return this.runDailyConfirmation({ catchUp: true });
  }

  /** Одно сообщение учителю со всеми неподтверждёнными уроками на сегодня */
  async askTeacher(teacherId: number, notice?: string) {
    const date = dateOnly(this.now());
    const sessions = await this.prisma.lessonSession.findMany({
      where: { date, status: 'SCHEDULED', lesson: { teacherId, isContinuous: true } },
      include: SESSION_INCLUDE,
      orderBy: { startsAt: 'asc' },
    });
    const teacher = await this.prisma.teacher.findUnique({ where: { id: teacherId }, include: { user: true } });
    if (!teacher) return;
    if (!sessions.length) {
      return this.menu.show(teacher.user, this.cfg.isAdmin(String(teacher.user.telegramId)), notice);
    }
    const kb = new InlineKeyboard();
    const blocks = sessions.map((s, i) => {
      const n = sessions.length > 1 ? `${i + 1}. ` : '';
      kb.text(`✅ ${n}Ha, bo'ladi`, `ls:yes:${s.id}`).text(`❌ ${n}Yo'q`, `ls:no:${s.id}`).row();
      const pt = pageTopicLine(s.pageFrom, s.topic);
      return (
        `${n}<b>Bugun ${weekDayName(this.now().weekDay)} darsingiz bo'ladimi?${pt ? ` ${pt}` : ''}</b>\n\n` +
        lessonCard(s.lesson, { startsAt: s.startsAt, page: s.pageFrom, topic: s.topic })
      );
    });
    await this.messenger.send(
      teacher.user.telegramId,
      `${notice ? `${notice}\n\n` : ''}🌅 <b>Assalomu alaykum, ${esc(teacher.user.fullName)}!</b>\n\n${blocks.join('\n\n')}`,
      { reply_markup: kb },
    );
    await this.prisma.lessonSession.updateMany({
      where: { id: { in: sessions.map((s) => s.id) } },
      data: { askedAt: new Date() },
    });
  }

  private async assertTeacher(session: SessionFull, teacherUserId?: number) {
    if (teacherUserId && session.lesson.teacher.userId !== teacherUserId) {
      throw new ForbiddenException('Bu sizning darsingiz emas');
    }
  }

  private async studentChatIds(lessonId: number) {
    const rows = await this.prisma.enrollment.findMany({
      where: { lessonId, status: 'ACTIVE', student: { status: 'APPROVED' } },
      select: { student: { select: { telegramId: true } } },
    });
    return rows.map((r) => r.student.telegramId);
  }

  private studentKeyboard(s: SessionFull) {
    const kb = new InlineKeyboard();
    const map = s.lesson.location?.map_url;
    if (map && isTelegramSafeUrl(map)) kb.url('📍 Xaritada ochish', map).row();
    this.menu.webAppButton(kb, '📱 Dars sahifasi', `/lessons/${s.lessonId}`);
    return kb.text('⬅️ Bosh menyu', 'menu:home');
  }

  /** «Ha bo'ladi» -> студентам: «Bugun dars bor 56-bet» */
  async confirm(sessionId: number, teacherUserId?: number) {
    const s = await this.get(sessionId);
    await this.assertTeacher(s, teacherUserId);
    if (s.status === 'CANCELLED') throw new BadRequestException('Dars allaqachon bekor qilingan');
    const updated = await this.prisma.lessonSession.update({
      where: { id: sessionId },
      data: { status: 'CONFIRMED', confirmedAt: new Date() },
      include: SESSION_INCLUDE,
    });
    const chatIds = await this.studentChatIds(s.lessonId);
    await this.notifications.sendMany(
      chatIds,
      `✅ <b>Bugun dars bor${updated.pageFrom ? `: ${updated.pageFrom}-betdan` : ''}</b>\n\n` +
        lessonCard(updated.lesson, { startsAt: updated.startsAt, page: updated.pageFrom, topic: updated.topic }),
      { reply_markup: this.studentKeyboard(updated) },
    );
    await this.scheduleReminder(updated);
    return { session: updated, notified: chatIds.length };
  }

  /** «Yo'q» + обязательная причина -> студентам: «Bugun dars bekor qilindi. Sabab: ...» */
  async cancel(sessionId: number, reason: string, teacherUserId?: number) {
    const clean = (reason || '').trim();
    if (clean.length < 3) throw new BadRequestException('Sababni yozing (kamida 3 ta belgi)');
    const s = await this.get(sessionId);
    await this.assertTeacher(s, teacherUserId);
    const updated = await this.prisma.lessonSession.update({
      where: { id: sessionId },
      data: { status: 'CANCELLED', cancelReason: clean },
      include: SESSION_INCLUDE,
    });
    const chatIds = await this.studentChatIds(s.lessonId);
    await this.notifications.sendMany(
      chatIds,
      `❌ <b>Bugun dars bekor qilindi.</b>\nSabab: ${esc(clean)}\n\n` +
        `📘 ${esc(s.lesson.subject.name)} — ${esc(s.lesson.teacher.user.fullName)}` +
        (s.pageFrom || s.topic ? `\n📖 ${pageTopicLine(s.pageFrom, s.topic)} keyingi darsda o'tiladi.` : ''),
      { reply_markup: new InlineKeyboard().text('⬅️ Bosh menyu', 'menu:home') },
    );
    return { session: updated, notified: chatIds.length };
  }

  /** Поставить отложенное напоминание (за 2ч30м) в очередь BullMQ */
  async scheduleReminder(s: { id: number; startsAt: Date | null; status: string; reminderSentAt: Date | null }) {
    if (!s.startsAt || s.reminderSentAt || s.status === 'CANCELLED' || s.status === 'DONE') return;
    if (s.startsAt.getTime() <= Date.now()) return;
    await this.notifications.scheduleReminder(s.id, new Date(s.startsAt.getTime() - REMINDER_BEFORE_MS));
  }

  /** Напоминание студентам и учителю: страница и тема */
  async sendReminder(sessionId: number) {
    // Атомарно «захватываем» отправку, чтобы cron и очередь не дублировали
    const claimed = await this.prisma.lessonSession.updateMany({
      where: { id: sessionId, reminderSentAt: null, status: { in: ['SCHEDULED', 'CONFIRMED'] } },
      data: { reminderSentAt: new Date() },
    });
    if (!claimed.count) return { sent: 0 };
    const s = await this.get(sessionId);
    const startText = s.startsAt ? formatHHmm(s.startsAt, this.cfg.timezone) : s.lesson.startTime;
    const text =
      `⏰ <b>Eslatma: dars ${startText} da boshlanadi</b>\n\n` +
      (s.pageFrom ? `📖 Bugun: <b>${s.pageFrom}-betdan</b>\n` : '') +
      (s.topic ? `📝 Mavzu: <b>${esc(s.topic)}</b>\n` : '') +
      `\n` +
      lessonCard(s.lesson, { startsAt: s.startsAt, page: s.pageFrom, topic: s.topic });
    const chatIds = await this.studentChatIds(s.lessonId);
    await this.notifications.sendMany([...chatIds, s.lesson.teacher.user.telegramId], text, {
      reply_markup: this.studentKeyboard(s),
    });
    this.logger.log(`Eslatma yuborildi: sessiya #${sessionId}, ${chatIds.length} talaba`);
    return { sent: chatIds.length + 1 };
  }

  /** Подстраховка (cron каждые 5 минут): напоминания, которые должны были уйти */
  async sendDueReminders() {
    const now = Date.now();
    const due = await this.prisma.lessonSession.findMany({
      where: {
        reminderSentAt: null,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        lesson: { isContinuous: true },
        startsAt: { gt: new Date(now), lte: new Date(now + REMINDER_BEFORE_MS) },
      },
      select: { id: true },
    });
    for (const s of due) await this.sendReminder(s.id);
    return due.length;
  }

  // ---------- Посещаемость ----------

  async attendance(sessionId: number) {
    const s = await this.get(sessionId);
    const [students, marks] = await Promise.all([
      this.lessons.students(s.lessonId),
      this.prisma.attendance.findMany({ where: { sessionId } }),
    ]);
    const byStudent = new Map(marks.map((m) => [m.studentId, m]));
    return {
      session: s,
      items: students.map((st) => ({ student: st, status: byStudent.get(st.id)?.status ?? null, note: byStudent.get(st.id)?.note ?? null })),
    };
  }

  async setAttendance(
    sessionId: number,
    items: Array<{ studentId: number; status: AttendanceStatus; note?: string }>,
    teacherUserId?: number,
  ) {
    const s = await this.get(sessionId);
    await this.assertTeacher(s, teacherUserId);
    await this.prisma.$transaction(
      items.map((i) =>
        this.prisma.attendance.upsert({
          where: { sessionId_studentId: { sessionId, studentId: i.studentId } },
          update: { status: i.status, note: i.note, markedAt: new Date() },
          create: { sessionId, studentId: i.studentId, status: i.status, note: i.note },
        }),
      ),
    );
    return this.attendance(sessionId);
  }

  /** Циклическое переключение статуса (для кнопок бота) */
  async toggleAttendance(sessionId: number, studentId: number, teacherUserId: number) {
    const s = await this.get(sessionId);
    await this.assertTeacher(s, teacherUserId);
    const order: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
    const cur = await this.prisma.attendance.findUnique({ where: { sessionId_studentId: { sessionId, studentId } } });
    const next = cur ? order[(order.indexOf(cur.status) + 1) % order.length] : 'PRESENT';
    await this.prisma.attendance.upsert({
      where: { sessionId_studentId: { sessionId, studentId } },
      update: { status: next, markedAt: new Date() },
      create: { sessionId, studentId, status: next },
    });
  }

  async markAllPresent(sessionId: number, teacherUserId: number) {
    const { items } = await this.attendance(sessionId);
    const unmarked = items.filter((i) => !i.status).map((i) => ({ studentId: i.student.id, status: 'PRESENT' as const }));
    if (unmarked.length) await this.setAttendance(sessionId, unmarked, teacherUserId);
  }

  /** Сохранить посещаемость: неотмеченные -> «Kelmadi» */
  async finalizeAttendance(sessionId: number, teacherUserId?: number) {
    const { items, session } = await this.attendance(sessionId);
    await this.assertTeacher(session, teacherUserId);
    const unmarked = items.filter((i) => !i.status).map((i) => ({ studentId: i.student.id, status: 'ABSENT' as const }));
    if (unmarked.length) await this.setAttendance(sessionId, unmarked, teacherUserId);
    return this.get(sessionId);
  }

  /**
   * ▶ Начать урок. Если страница начала неизвестна (продолжающаяся книга) — её нужно указать.
   */
  async start(sessionId: number, dto: { pageFrom?: number; topic?: string }, teacherUserId?: number) {
    const s = await this.get(sessionId);
    await this.assertTeacher(s, teacherUserId);
    if (s.status === 'CANCELLED') throw new BadRequestException('Dars bekor qilingan');
    if (s.status === 'DONE') throw new BadRequestException('Dars allaqachon yakunlangan');
    const pageFrom = dto.pageFrom ?? s.pageFrom ?? s.lesson.currentPage;
    if (!pageFrom) throw new BadRequestException('Qaysi betdan boshlayotganingizni yozing');
    if (pageFrom > s.lesson.bookTotalPages) throw new BadRequestException(`Kitobda ${s.lesson.bookTotalPages} bet bor`);
    const topic = dto.topic?.trim() || s.topic || s.lesson.topic || null;
    return this.prisma.lessonSession.update({
      where: { id: sessionId },
      data: { status: 'STARTED', startedAt: new Date(), pageFrom, topic },
      include: SESSION_INCLUDE,
    });
  }

  /**
   * ⏹ Закончить урок: до какой страницы дошли + тема следующего урока.
   * Следующий урок начнётся со следующей страницы.
   */
  async finish(sessionId: number, dto: { pageTo: number; nextTopic?: string }, teacherUserId?: number) {
    const s = await this.get(sessionId);
    await this.assertTeacher(s, teacherUserId);
    if (s.status === 'CANCELLED') throw new BadRequestException('Dars bekor qilingan');
    const total = s.lesson.bookTotalPages;
    const pageFrom = s.pageFrom ?? s.lesson.currentPage;
    if (!Number.isInteger(dto.pageTo) || dto.pageTo < 1) throw new BadRequestException('Betni to\'g\'ri yozing');
    if (dto.pageTo > total) throw new BadRequestException(`Kitobda ${total} bet bor`);
    if (pageFrom && dto.pageTo < pageFrom) throw new BadRequestException(`Dars ${pageFrom}-betdan boshlangan`);
    await this.finalizeAttendance(sessionId, teacherUserId);
    const nextTopic = dto.nextTopic?.trim() || null;
    const [session] = await this.prisma.$transaction([
      this.prisma.lessonSession.update({
        where: { id: sessionId },
        data: { status: 'DONE', finishedAt: new Date(), pageTo: dto.pageTo, pageFrom: pageFrom ?? dto.pageTo, startedAt: s.startedAt ?? new Date() },
        include: SESSION_INCLUDE,
      }),
      this.prisma.lesson.update({
        where: { id: s.lessonId },
        data: { currentPage: Math.min(dto.pageTo + 1, total), topic: nextTopic },
      }),
    ]);
    return session;
  }

  /** Занятия учителя: сегодня + последние (для меню «Davomat») */
  async teacherSessions(teacherUserId: number) {
    const teacher = await this.prisma.teacher.findUnique({ where: { userId: teacherUserId } });
    if (!teacher) return [];
    // Гарантируем наличие занятий на сегодня
    const today = this.now();
    const todayLessons = await this.prisma.lesson.findMany({
      where: { teacherId: teacher.id, weekDays: { has: today.weekDay }, isActive: true },
      select: { id: true },
    });
    for (const l of todayLessons) await this.ensureSession(l.id, today);
    return this.prisma.lessonSession.findMany({
      // Сегодняшние + прошедшие, которые действительно были (начаты/завершены/отменены)
      where: {
        lesson: { teacherId: teacher.id },
        OR: [{ date: dateOnly(today) }, { date: { lt: dateOnly(today) }, status: { in: ['STARTED', 'DONE', 'CANCELLED'] } }],
      },
      include: { ...SESSION_INCLUDE, _count: { select: { attendances: true } } },
      orderBy: [{ date: 'desc' }, { startsAt: 'asc' }],
      take: 8,
    });
  }

  // ---------- Оценки ----------

  async addGrade(lessonId: number, teacherUserId: number | null, dto: { studentId: number; score: number; comment?: string; sessionId?: number }) {
    const lesson = await this.lessons.findOrThrow(lessonId);
    if (teacherUserId && lesson.teacher.userId !== teacherUserId) throw new ForbiddenException('Bu sizning darsingiz emas');
    const grade = await this.prisma.grade.create({
      data: { lessonId, teacherId: lesson.teacherId, studentId: dto.studentId, score: dto.score, comment: dto.comment, sessionId: dto.sessionId },
      include: { student: true },
    });
    const stars = '⭐️'.repeat(dto.score);
    await this.messenger.send(
      grade.student.telegramId,
      `📊 <b>Yangi baho</b>\n\n📘 ${esc(lesson.subject.name)} — ${esc(lesson.teacher.user.fullName)}\nBaho: <b>${dto.score}</b> ${stars}` +
        (dto.comment ? `\n💬 ${esc(dto.comment)}` : ''),
      { reply_markup: new InlineKeyboard().text('📊 Baholarim', 'menu:grades').text('⬅️ Bosh menyu', 'menu:home') },
    );
    return grade;
  }

  lessonGrades(lessonId: number) {
    return this.prisma.grade.findMany({
      where: { lessonId },
      include: { student: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Статистика студента: посещаемость и средний балл */
  async studentStats(studentId: number) {
    const [att, grades] = await Promise.all([
      this.prisma.attendance.groupBy({ by: ['status'], where: { studentId }, _count: true }),
      this.prisma.grade.findMany({
        where: { studentId },
        include: { lesson: { include: { subject: true, teacher: { include: { user: { select: { fullName: true } } } } } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);
    const counts = Object.fromEntries(att.map((a) => [a.status, a._count])) as Partial<Record<AttendanceStatus, number>>;
    const total = Object.values(counts).reduce((a, b) => a + (b || 0), 0);
    const attended = (counts.PRESENT || 0) + (counts.LATE || 0);
    const avg = grades.length ? grades.reduce((a, g) => a + g.score, 0) / grades.length : null;
    return {
      attendance: { ...counts, total, percent: total ? Math.round((attended / total) * 100) : null },
      averageScore: avg !== null ? Math.round(avg * 10) / 10 : null,
      grades,
    };
  }
}
