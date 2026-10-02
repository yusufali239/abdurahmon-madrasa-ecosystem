import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { resolveStartMinutes } from '../common/lesson-time';
import { minutesToHHmm } from '../common/prayer-times';
import { effectivePrice } from '../common/pricing';
import { signStreamToken } from '../common/stream-token';
import { dateKeyDaysAgo, nextLessonDates, zonedParts } from '../common/time.util';
import { AppConfig } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLessonDto, UpdateLessonDto } from './lessons.dto';

export const LESSON_INCLUDE = {
  subject: true,
  location: true,
  teacher: { include: { user: { select: { id: true, fullName: true, username: true } } } },
  _count: { select: { enrollments: { where: { status: 'ACTIVE' as const } }, contents: true } },
} satisfies Prisma.LessonInclude;

@Injectable()
export class LessonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: AppConfig,
  ) {}

  /** Вычисляемые поля для фронтенда */
  decorate<T extends { priceTier: number; customPrice: number | null; startTime: string; startClock: string | null; currentPage: number | null; bookTotalPages: number }>(l: T) {
    const m = resolveStartMinutes(l, zonedParts(new Date(), this.cfg.timezone));
    const pagesDone = l.currentPage ? Math.min(l.currentPage - 1, l.bookTotalPages) : null;
    return {
      ...l,
      price: effectivePrice(l),
      approxStart: m !== null ? minutesToHHmm(m) : null,
      pagesDone,
      progressPercent: pagesDone !== null ? Math.round((pagesDone / l.bookTotalPages) * 100) : null,
    };
  }

  async list(user: User, q: { subjectId?: number; weekDay?: number; teacherId?: number; mine?: boolean }) {
    const where: Prisma.LessonWhereInput = {
      isActive: true,
      subjectId: q.subjectId,
      weekDays: q.weekDay ? { has: q.weekDay } : undefined,
      teacherId: q.teacherId,
    };
    if (q.mine) {
      if (user.role === 'TEACHER') where.teacher = { userId: user.id };
      else where.enrollments = { some: { studentId: user.id, status: 'ACTIVE' } };
      delete where.isActive;
    }
    const lessons = await this.prisma.lesson.findMany({
      where,
      include: { ...LESSON_INCLUDE, enrollments: { where: { studentId: user.id }, select: { status: true } } },
      orderBy: [{ id: 'asc' }],
    });
    return lessons.map(({ enrollments, ...l }) => ({
      ...this.decorate(l),
      enrolled: enrollments[0]?.status === 'ACTIVE',
    }));
  }

  async findOrThrow(id: number) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id }, include: LESSON_INCLUDE });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    return lesson;
  }

  /** Есть ли у пользователя доступ к платному контенту урока */
  async hasAccess(user: User, lesson: { id: number; teacherId: number; priceTier: number; customPrice: number | null }) {
    if (this.cfg.isAdmin(String(user.telegramId))) return true;
    const teacher = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
    if (teacher?.id === lesson.teacherId) return true;
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { lessonId_studentId: { lessonId: lesson.id, studentId: user.id } },
    });
    if (enrollment?.status !== 'ACTIVE') return false;
    if (effectivePrice(lesson) === 0) return true;
    // Оплата за день: платные материалы открыты, если урок оплачен хотя бы раз за последние 30 дней
    const paid = await this.prisma.payment.findFirst({
      where: { studentId: user.id, lessonId: lesson.id, status: 'CONFIRMED', period: { gte: dateKeyDaysAgo(30, this.cfg.timezone) } },
    });
    return !!paid;
  }

  async detail(user: User, id: number) {
    const lesson = await this.findOrThrow(id);
    const access = await this.hasAccess(user, lesson);
    const dates = nextLessonDates(lesson.weekDays, 4, this.cfg.timezone);
    const nextDate = dates[0]?.date ?? null;
    const [contents, enrollment, payments, attendances, grades, sessions] = await Promise.all([
      this.prisma.lessonContent.findMany({ where: { lessonId: id }, orderBy: [{ type: 'asc' }, { createdAt: 'desc' }] }),
      this.prisma.enrollment.findUnique({ where: { lessonId_studentId: { lessonId: id, studentId: user.id } } }),
      this.prisma.payment.findMany({ where: { lessonId: id, studentId: user.id }, orderBy: { createdAt: 'desc' }, take: 10 }),
      this.prisma.attendance.findMany({
        where: { studentId: user.id, session: { lessonId: id } },
        include: { session: { select: { date: true, pageFrom: true, pageTo: true, topic: true } } },
        orderBy: { markedAt: 'desc' },
        take: 20,
      }),
      this.prisma.grade.findMany({ where: { lessonId: id, studentId: user.id }, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.prisma.lessonSession.findMany({ where: { lessonId: id }, orderBy: { date: 'desc' }, take: 8 }),
    ]);
    const base = this.cfg.publicApiUrl;
    return {
      ...this.decorate(lesson),
      hasAccess: access,
      enrolled: enrollment?.status === 'ACTIVE',
      nextDate,
      nextDates: dates,
      // Оплачен ли ближайший день урока
      paidNext: payments.some((p) => p.period === nextDate && p.status === 'CONFIRMED'),
      pendingNext: payments.find((p) => p.period === nextDate && p.status === 'PENDING') ?? null,
      // Для ученика способ оплаты (учителю / фонд) не раскрывается
      payments: payments.map(({ paymentType: _t, ...p }) => p),
      attendances,
      grades,
      sessions,
      contents: contents.map((c) => {
        const unlocked = c.isFree || access;
        const isExternalVideo = c.type === 'VIDEO' && /youtube\.com|youtu\.be|vimeo\.com/i.test(c.url);
        return {
          id: c.id,
          type: c.type,
          title: c.title,
          isFree: c.isFree,
          durationSec: c.durationSec,
          pageCount: c.pageCount,
          createdAt: c.createdAt,
          locked: !unlocked,
          url: unlocked
            ? isExternalVideo
              ? c.url
              : `${base}/api/content/${c.id}/stream?t=${signStreamToken(c.id, user.id, this.cfg.jwtSecret)}`
            : null,
        };
      }),
    };
  }

  private validatePages(d: { bookTotalPages: number; currentPage?: number | null }) {
    if (d.currentPage && d.currentPage > d.bookTotalPages) throw new BadRequestException('Bet kitobdagi betlar sonidan oshmasin');
  }

  async create(teacherId: number, dto: CreateLessonDto) {
    this.validatePages(dto);
    await this.checkLocation(teacherId, dto.locationId);
    // Учитель автоматически получает предмет урока
    await this.prisma.teacher.update({ where: { id: teacherId }, data: { subjects: { connect: { id: dto.subjectId } } } });
    return this.prisma.lesson.create({
      data: {
        ...dto,
        weekDays: [...new Set(dto.weekDays)].sort(),
        teacherId,
        isContinuous: dto.isContinuous ?? true,
        customPrice: dto.customPrice || null,
        // Новая книга начинается с 1-й страницы; для продолжающейся страницу спросим при старте урока
        currentPage: dto.isNewBook ? 1 : (dto.currentPage ?? null),
        topic: dto.topic || null,
      },
      include: LESSON_INCLUDE,
    });
  }

  async update(id: number, dto: UpdateLessonDto, teacherId?: number) {
    const lesson = await this.findOrThrow(id);
    if (teacherId && lesson.teacherId !== teacherId) throw new ForbiddenException('Bu sizning darsingiz emas');
    this.validatePages({ ...lesson, ...dto } as any);
    if (dto.locationId !== undefined) await this.checkLocation(lesson.teacherId, dto.locationId);
    return this.prisma.lesson.update({
      where: { id },
      data: {
        ...dto,
        weekDays: dto.weekDays ? [...new Set(dto.weekDays)].sort() : undefined,
        customPrice: dto.customPrice === 0 ? null : dto.customPrice,
      },
      include: LESSON_INCLUDE,
    });
  }

  async remove(id: number, teacherId?: number) {
    const lesson = await this.findOrThrow(id);
    if (teacherId && lesson.teacherId !== teacherId) throw new ForbiddenException('Bu sizning darsingiz emas');
    return this.prisma.lesson.update({ where: { id }, data: { isActive: false } });
  }

  async enroll(user: User, lessonId: number) {
    if (user.role !== 'STUDENT') throw new BadRequestException('Faqat talabalar darsga yozilishi mumkin');
    const lesson = await this.findOrThrow(lessonId);
    if (!lesson.isActive) throw new BadRequestException('Dars faol emas');
    return this.prisma.enrollment.upsert({
      where: { lessonId_studentId: { lessonId, studentId: user.id } },
      update: { status: 'ACTIVE' },
      create: { lessonId, studentId: user.id },
    });
  }

  async unenroll(user: User, lessonId: number) {
    return this.prisma.enrollment.updateMany({ where: { lessonId, studentId: user.id }, data: { status: 'LEFT' } });
  }

  async students(lessonId: number) {
    const rows = await this.prisma.enrollment.findMany({
      where: { lessonId, status: 'ACTIVE' },
      include: { student: { select: { id: true, fullName: true, phone: true, username: true } } },
      orderBy: { student: { fullName: 'asc' } },
    });
    return rows.map((r) => r.student);
  }

  private async checkLocation(teacherId: number, locationId?: number | null) {
    if (!locationId) return;
    const loc = await this.prisma.teacherLocation.findUnique({ where: { id: locationId } });
    if (!loc || loc.teacherId !== teacherId) throw new BadRequestException('Manzil topilmadi');
  }
}
