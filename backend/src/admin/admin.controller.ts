import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { NewsType, PaymentStatus, PaymentType, Role } from '@prisma/client';
import { AdminGuard } from '../auth/guards';
import { dateOnly } from '../common/time.util';
import { ContentService } from '../content/content.service';
import { FundService } from '../fund/fund.service';
import { AdvanceLessonDto, CreateLessonDto, UpdateLessonDto } from '../lessons/lessons.dto';
import { LESSON_INCLUDE, LessonsService } from '../lessons/lessons.service';
import { SessionsService } from '../lessons/sessions.service';
import { NewsService } from '../news/news.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubjectInput, SubjectsService } from '../subjects/subjects.service';
import { detectProvider } from '../teachers/teachers.service';
import { MAX_UPLOAD_BYTES, UploadsService } from '../uploads/uploads.service';
import { UsersService } from '../users/users.service';

/** API админ-панели. Доступ — JWT администратора (ADMIN_IDS). */
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly lessons: LessonsService,
    private readonly sessions: SessionsService,
    private readonly subjects: SubjectsService,
    private readonly payments: PaymentsService,
    private readonly fund: FundService,
    private readonly news: NewsService,
    private readonly uploads: UploadsService,
    private readonly content: ContentService,
  ) {}

  private actor(req: any) {
    return { kind: 'admin' as const, telegramId: req.admin.sub as string };
  }

  // ---------- Дашборд ----------

  @Get('stats')
  async stats() {
    const today = this.sessions.now();
    const [students, teachers, pendingUsers, lessons, pendingPayments, confirmedSum, newsCount, todaySessions, fund] = await Promise.all([
      this.prisma.user.count({ where: { role: 'STUDENT', status: 'APPROVED' } }),
      this.prisma.user.count({ where: { role: 'TEACHER', status: 'APPROVED' } }),
      this.prisma.user.count({ where: { status: 'PENDING', regStep: 'DONE' } }),
      this.prisma.lesson.count({ where: { isActive: true } }),
      this.prisma.payment.count({ where: { status: 'PENDING' } }),
      this.prisma.payment.aggregate({ where: { status: 'CONFIRMED', paymentType: 'MBANK_SELF' }, _sum: { amount: true } }),
      this.prisma.news.count(),
      this.prisma.lessonSession.findMany({
        where: { date: dateOnly(today) },
        include: { lesson: { include: { subject: true, teacher: { include: { user: { select: { fullName: true } } } } } } },
        orderBy: { startsAt: 'asc' },
      }),
      this.fund.summary(),
    ]);
    return {
      students,
      teachers,
      pendingUsers,
      lessons,
      pendingPayments,
      mbankConfirmedTotal: confirmedSum._sum.amount ?? 0,
      newsCount,
      todaySessions,
      fund,
      weekDay: today.weekDay,
    };
  }

  // ---------- Пользователи ----------

  @Get('users')
  listUsers(@Query('status') status?: string, @Query('role') role?: string, @Query('q') q?: string) {
    return this.users.list({ status, role, q });
  }

  @Post('users/:id/approve')
  approve(@Param('id', ParseIntPipe) id: number, @Body() body: { role?: Role }) {
    return this.users.approve(id, body?.role);
  }

  @Post('users/:id/reject')
  reject(@Param('id', ParseIntPipe) id: number) {
    return this.users.reject(id);
  }

  @Post('users/:id/block')
  block(@Param('id', ParseIntPipe) id: number) {
    return this.users.setStatus(id, 'BLOCKED');
  }

  @Post('users/:id/unblock')
  unblock(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.user.update({ where: { id }, data: { status: 'APPROVED' } });
  }

  @Patch('users/:id')
  updateUser(@Param('id', ParseIntPipe) id: number, @Body() body: { role?: Role; fullName?: string; phone?: string }) {
    if (body.role) return this.users.setRole(id, body.role);
    return this.prisma.user.update({ where: { id }, data: { fullName: body.fullName, phone: body.phone } });
  }

  // ---------- Учителя ----------

  @Get('teachers')
  teachers() {
    return this.prisma.teacher.findMany({
      include: {
        user: true,
        subjects: true,
        locations: true,
        donationFund: true,
        _count: { select: { lessons: { where: { isActive: true } } } },
      },
      orderBy: { id: 'asc' },
    });
  }

  @Patch('teachers/:id')
  updateTeacher(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { telegramPhone?: string; mbankNumber?: string; bio?: string; subjectIds?: number[] },
  ) {
    return this.prisma.teacher.update({
      where: { id },
      data: {
        telegramPhone: body.telegramPhone,
        mbankNumber: body.mbankNumber,
        bio: body.bio,
        subjects: body.subjectIds ? { set: body.subjectIds.map((sid) => ({ id: sid })) } : undefined,
      },
      include: { user: true, subjects: true },
    });
  }

  @Post('teachers/:id/locations')
  addLocation(
    @Param('id', ParseIntPipe) teacherId: number,
    @Body() body: { title: string; address: string; map_url: string; lat?: number; lng?: number; provider?: any },
  ) {
    return this.prisma.teacherLocation.create({
      data: { ...body, teacherId, provider: detectProvider(body.map_url) ?? body.provider ?? 'TWOGIS' },
    });
  }

  @Delete('locations/:id')
  removeLocation(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.teacherLocation.delete({ where: { id } });
  }

  // ---------- Предметы ----------

  @Get('subjects')
  listSubjects() {
    return this.subjects.list();
  }

  @Post('subjects')
  createSubject(@Body() body: SubjectInput) {
    if (!body?.name) throw new BadRequestException('Nomi kerak');
    return this.subjects.create(body);
  }

  @Patch('subjects/:id')
  updateSubject(@Param('id', ParseIntPipe) id: number, @Body() body: Partial<SubjectInput>) {
    return this.subjects.update(id, body);
  }

  @Delete('subjects/:id')
  removeSubject(@Param('id', ParseIntPipe) id: number) {
    return this.subjects.remove(id);
  }

  // ---------- Уроки ----------

  @Get('lessons')
  async listLessons(@Query('teacherId') teacherId?: string, @Query('subjectId') subjectId?: string) {
    const rows = await this.prisma.lesson.findMany({
      where: { teacherId: teacherId ? Number(teacherId) : undefined, subjectId: subjectId ? Number(subjectId) : undefined },
      include: LESSON_INCLUDE,
      orderBy: [{ isActive: 'desc' }, { weekDay: 'asc' }],
    });
    return rows.map((l) => this.lessons.decorate(l));
  }

  @Get('lessons/:id')
  async lesson(@Param('id', ParseIntPipe) id: number) {
    const lesson = await this.lessons.findOrThrow(id);
    const [students, sessions, grades, contents, payments] = await Promise.all([
      this.lessons.students(id),
      this.prisma.lessonSession.findMany({
        where: { lessonId: id },
        include: { attendances: { include: { student: { select: { id: true, fullName: true } } } } },
        orderBy: { date: 'desc' },
        take: 20,
      }),
      this.sessions.lessonGrades(id),
      this.prisma.lessonContent.findMany({ where: { lessonId: id }, orderBy: { createdAt: 'desc' } }),
      this.payments.list({ teacherId: lesson.teacherId }).then((p) => p.filter((x) => x.lessonId === id)),
    ]);
    return { ...this.lessons.decorate(lesson), students, sessions, grades, contents, payments };
  }

  @Post('lessons')
  createLesson(@Body() body: CreateLessonDto & { teacherId: number }) {
    if (!body?.teacherId) throw new BadRequestException('Ustozni tanlang');
    const { teacherId, ...dto } = body;
    return this.lessons.create(Number(teacherId), dto as CreateLessonDto);
  }

  @Patch('lessons/:id')
  updateLesson(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLessonDto) {
    return this.lessons.update(id, dto);
  }

  @Post('lessons/:id/advance')
  advance(@Param('id', ParseIntPipe) id: number, @Body() dto: AdvanceLessonDto) {
    return this.lessons.advance(id, dto);
  }

  @Post('lessons/:id/contents')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async addContent(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { type?: any; title?: string; url?: string; isFree?: string },
  ) {
    let url = body.url;
    let type = body.type;
    if (file) {
      url = (await this.uploads.save(file, 'content')).url;
      type = type || (file.mimetype.startsWith('audio/') ? 'AUDIO' : file.mimetype.startsWith('video/') ? 'VIDEO' : 'PDF');
    }
    if (!url || !type) throw new BadRequestException('Fayl yoki havola kerak');
    return this.content.create(id, { type, url, title: body.title || file?.originalname || '', isFree: body.isFree === 'true' });
  }

  @Delete('contents/:id')
  removeContent(@Param('id', ParseIntPipe) id: number) {
    return this.content.remove(id);
  }

  // ---------- Занятия / cron ----------

  @Post('cron/daily-confirmation')
  runDaily() {
    return this.sessions.runDailyConfirmation();
  }

  @Post('sessions/:id/confirm')
  confirmSession(@Param('id', ParseIntPipe) id: number) {
    return this.sessions.confirm(id);
  }

  @Post('sessions/:id/cancel')
  cancelSession(@Param('id', ParseIntPipe) id: number, @Body() body: { reason: string }) {
    return this.sessions.cancel(id, body?.reason);
  }

  // ---------- Платежи ----------

  @Get('payments')
  listPayments(@Query('status') status?: PaymentStatus, @Query('type') type?: PaymentType) {
    return this.payments.list({ status: status || undefined, paymentType: type || undefined });
  }

  @Post('payments/:id/confirm')
  confirmPayment(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.payments.confirm(id, this.actor(req));
  }

  @Post('payments/:id/reject')
  rejectPayment(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string }) {
    return this.payments.reject(id, this.actor(req), body?.reason);
  }

  // ---------- Фонд Hayriya ----------

  @Get('fund')
  async fundSummary() {
    const [summary, teachers, reports] = await Promise.all([this.fund.summary(), this.fund.teachersBreakdown(), this.fund.reports()]);
    return { summary, teachers, reports: reports.map((r) => ({ ...r, video_url: this.uploads.absolute(r.video_url) })) };
  }

  @Get('donations')
  donations(@Query('status') status?: 'PENDING' | 'CONFIRMED' | 'REJECTED') {
    return this.prisma.donation.findMany({
      where: { status: status || undefined },
      include: {
        student: { select: { fullName: true, phone: true } },
        teacher: { include: { user: { select: { fullName: true } } } },
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
  }

  @Put('fund/limit')
  setLimit(@Body() body: { limit: number }) {
    const limit = Number(body?.limit);
    if (!Number.isInteger(limit) || limit <= 0) throw new BadRequestException('Limit musbat butun son bo\'lsin');
    return this.fund.setLimit(limit);
  }

  @Post('fund/reports')
  createReport(@Body() body: { video_url: string; description: string; spentAmount: number }) {
    if (!body?.video_url || !body?.description) throw new BadRequestException('Video va tavsif majburiy');
    const spentAmount = Number(body.spentAmount);
    if (!Number.isInteger(spentAmount) || spentAmount <= 0) throw new BadRequestException('Sarflangan summa noto\'g\'ri');
    return this.fund.createReport({ video_url: body.video_url, description: body.description, spentAmount });
  }

  @Delete('fund/reports/:id')
  deleteReport(@Param('id', ParseIntPipe) id: number) {
    return this.fund.deleteReport(id);
  }

  // ---------- Новости ----------

  @Get('news')
  listNews() {
    return this.news.list(undefined, 200);
  }

  @Post('news')
  createNews(@Body() body: { title: string; body: string; image_url?: string; type: NewsType; push?: boolean }) {
    if (!body?.title || !body?.body) throw new BadRequestException('Sarlavha va matn majburiy');
    if (!['TADBIR', 'SPORT_FUTBOL', 'ELON'].includes(body.type)) throw new BadRequestException('Turi noto\'g\'ri');
    return this.news.create({ title: body.title, body: body.body, image_url: body.image_url || null, type: body.type }, body.push !== false);
  }

  @Patch('news/:id')
  updateNews(@Param('id', ParseIntPipe) id: number, @Body() body: { title?: string; body?: string; image_url?: string; type?: NewsType }) {
    return this.news.update(id, body);
  }

  @Post('news/:id/push')
  pushNews(@Param('id', ParseIntPipe) id: number) {
    return this.news.push(id).then(() => ({ ok: true }));
  }

  @Delete('news/:id')
  deleteNews(@Param('id', ParseIntPipe) id: number) {
    return this.news.remove(id);
  }

  // ---------- Файлы ----------

  @Post('uploads')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  upload(@UploadedFile() file: Express.Multer.File, @Query('kind') kind?: 'news' | 'reports' | 'content') {
    return this.uploads.save(file, kind && ['news', 'reports', 'content'].includes(kind) ? kind : 'news');
  }
}
