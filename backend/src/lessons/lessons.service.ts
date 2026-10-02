import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { resolveStartMinutes } from '../common/lesson-time';
import { minutesToHHmm } from '../common/prayer-times';
import { effectivePrice } from '../common/pricing';
import { signStreamToken } from '../common/stream-token';
import { currentPeriod, zonedParts } from '../common/time.util';
import { AppConfig } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdvanceLessonDto, CreateLessonDto, UpdateLessonDto } from './lessons.dto';

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
  decorate<T extends { priceTier: number; customPrice: number | null; startTime: string; startClock: string | null; currentPageTo: number; bookTotalPages: number }>(l: T) {
    const m = resolveStartMinutes(l, zonedParts(new Date(), this.cfg.timezone));
    return {
      ...l,
      price: effectivePrice(l),
      approxStart: m !== null ? minutesToHHmm(m) : null,
      progressPercent: Math.round((Math.min(l.currentPageTo, l.bookTotalPages) / l.bookTotalPages) * 100),
    };
  }

  async list(user: User, q: { subjectId?: number; weekDay?: number; teacherId?: number; mine?: boolean }) {
    const where: Prisma.LessonWhereInput = {
      isActive: true,
      subjectId: q.subjectId,
      weekDay: q.weekDay,
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
      orderBy: [{ weekDay: 'asc' }, { id: 'asc' }],
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
    const paid = await this.prisma.payment.findFirst({
      where: { studentId: user.id, lessonId: lesson.id, status: 'CONFIRMED', period: currentPeriod(this.cfg.timezone) },
    });
    return !!paid;
  }

  async detail(user: User, id: number) {
    const lesson = await this.findOrThrow(id);
    const access = await this.hasAccess(user, lesson);
    const period = currentPeriod(this.cfg.timezone);
    const [contents, enrollment, payments, attendances, grades, sessions] = await Promise.all([
      this.prisma.lessonContent.findMany({ where: { lessonId: id }, orderBy: [{ type: 'asc' }, { createdAt: 'desc' }] }),
      this.prisma.enrollment.findUnique({ where: { lessonId_studentId: { lessonId: id, studentId: user.id } } }),
      this.prisma.payment.findMany({ where: { lessonId: id, studentId: user.id }, orderBy: { createdAt: 'desc' }, take: 6 }),
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
      paidThisPeriod: payments.some((p) => p.period === period && p.status === 'CONFIRMED'),
      pendingPayment: payments.find((p) => p.period === period && p.status === 'PENDING') ?? null,
      period,
      payments,
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

  private validatePages(d: { bookTotalPages: number; currentPageFrom: number; currentPageTo: number }) {
    if (d.currentPageFrom > d.currentPageTo) throw new BadRequestException('Boshlang\'ich bet oxirgi betdan katta bo\'lmasin');
    if (d.currentPageTo > d.bookTotalPages) throw new BadRequestException('Bet kitobdagi betlar sonidan oshmasin');
  }

  async create(teacherId: number, dto: CreateLessonDto) {
    this.validatePages(dto);
    await this.checkLocation(teacherId, dto.locationId);
    // Учитель автоматически получает предмет урока
    await this.prisma.teacher.update({ where: { id: teacherId }, data: { subjects: { connect: { id: dto.subjectId } } } });
    return this.prisma.lesson.create({
      data: { ...dto, teacherId, isContinuous: dto.isContinuous ?? true, customPrice: dto.customPrice || null },
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
      data: { ...dto, customPrice: dto.customPrice === 0 ? null : dto.customPrice },
      include: LESSON_INCLUDE,
    });
  }

  async remove(id: number, teacherId?: number) {
    const lesson = await this.findOrThrow(id);
    if (teacherId && lesson.teacherId !== teacherId) throw new ForbiddenException('Bu sizning darsingiz emas');
    return this.prisma.lesson.update({ where: { id }, data: { isActive: false } });
  }

  /**
   * Продвижение по книге: следующий урок начинается со следующей страницы,
   * диапазон сохраняет прежний размер, тема берётся из nextTopic.
   */
  async advance(id: number, dto: AdvanceLessonDto = {}, teacherId?: number) {
    const l = await this.findOrThrow(id);
    if (teacherId && l.teacherId !== teacherId) throw new ForbiddenException('Bu sizning darsingiz emas');
    const span = l.currentPageTo - l.currentPageFrom;
    const from = dto.currentPageFrom ?? Math.min(l.currentPageTo + 1, l.bookTotalPages);
    const to = dto.currentPageTo ?? Math.min(from + span, l.bookTotalPages);
    this.validatePages({ bookTotalPages: l.bookTotalPages, currentPageFrom: from, currentPageTo: to });
    return this.prisma.lesson.update({
      where: { id },
      data: {
        currentPageFrom: from,
        currentPageTo: to,
        topic: dto.topic ?? l.nextTopic ?? l.topic,
        nextTopic: dto.nextTopic !== undefined ? dto.nextTopic : null,
      },
      include: LESSON_INCLUDE,
    });
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
