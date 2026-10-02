import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser, Roles, TelegramGuard } from '../auth/guards';
import { TeachersService } from '../teachers/teachers.service';
import { AdvanceLessonDto, CreateGradeDto, CreateLessonDto, SetAttendanceDto, UpdateLessonDto } from './lessons.dto';
import { LessonsService } from './lessons.service';
import { SessionsService } from './sessions.service';

const num = (v?: string) => (v ? Number(v) : undefined);

@Controller()
@UseGuards(TelegramGuard)
export class LessonsController {
  constructor(
    private readonly lessons: LessonsService,
    private readonly sessions: SessionsService,
    private readonly teachers: TeachersService,
  ) {}

  @Get('lessons')
  list(
    @CurrentUser() user: User,
    @Query('subjectId') subjectId?: string,
    @Query('weekDay') weekDay?: string,
    @Query('teacherId') teacherId?: string,
    @Query('mine') mine?: string,
  ) {
    return this.lessons.list(user, {
      subjectId: num(subjectId),
      weekDay: num(weekDay),
      teacherId: num(teacherId),
      mine: mine === 'true' || mine === '1',
    });
  }

  @Get('lessons/today')
  today(@CurrentUser() user: User) {
    return this.lessons.list(user, { weekDay: this.sessions.now().weekDay, mine: true });
  }

  @Get('lessons/:id')
  detail(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.lessons.detail(user, id);
  }

  @Post('lessons')
  @Roles('TEACHER')
  async create(@CurrentUser() user: User, @Body() dto: CreateLessonDto) {
    const t = await this.teachers.requireTeacher(user.id);
    return this.lessons.create(t.id, dto);
  }

  @Patch('lessons/:id')
  @Roles('TEACHER')
  async update(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLessonDto) {
    const t = await this.teachers.requireTeacher(user.id);
    return this.lessons.update(id, dto, t.id);
  }

  @Delete('lessons/:id')
  @Roles('TEACHER')
  async remove(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    const t = await this.teachers.requireTeacher(user.id);
    return this.lessons.remove(id, t.id);
  }

  @Post('lessons/:id/advance')
  @Roles('TEACHER')
  async advance(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number, @Body() dto: AdvanceLessonDto) {
    const t = await this.teachers.requireTeacher(user.id);
    return this.lessons.advance(id, dto, t.id);
  }

  @Post('lessons/:id/enroll')
  enroll(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.lessons.enroll(user, id);
  }

  @Delete('lessons/:id/enroll')
  unenroll(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.lessons.unenroll(user, id);
  }

  @Get('lessons/:id/students')
  @Roles('TEACHER')
  students(@Param('id', ParseIntPipe) id: number) {
    return this.lessons.students(id);
  }

  @Get('lessons/:id/grades')
  @Roles('TEACHER')
  grades(@Param('id', ParseIntPipe) id: number) {
    return this.sessions.lessonGrades(id);
  }

  @Post('lessons/:id/grades')
  @Roles('TEACHER')
  addGrade(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number, @Body() dto: CreateGradeDto) {
    return this.sessions.addGrade(id, user.id, dto);
  }

  /** Занятие на сегодня (создаётся при необходимости) — для отметки посещаемости */
  @Post('lessons/:id/sessions/today')
  @Roles('TEACHER')
  async todaySession(@Param('id', ParseIntPipe) id: number) {
    return this.sessions.ensureSession(id);
  }

  @Get('sessions/mine')
  @Roles('TEACHER')
  mySessions(@CurrentUser() user: User) {
    return this.sessions.teacherSessions(user.id);
  }

  @Get('sessions/:id/attendance')
  @Roles('TEACHER')
  attendance(@Param('id', ParseIntPipe) id: number) {
    return this.sessions.attendance(id);
  }

  @Put('sessions/:id/attendance')
  @Roles('TEACHER')
  async setAttendance(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number, @Body() dto: SetAttendanceDto) {
    const res = await this.sessions.setAttendance(id, dto.items, user.id);
    if (dto.finish) await this.sessions.finish(id, user.id);
    return res;
  }

  @Post('sessions/:id/confirm')
  @Roles('TEACHER')
  confirm(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.sessions.confirm(id, user.id);
  }

  @Post('sessions/:id/cancel')
  @Roles('TEACHER')
  cancel(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number, @Body() body: { reason: string }) {
    return this.sessions.cancel(id, body?.reason, user.id);
  }

  @Get('me/stats')
  stats(@CurrentUser() user: User) {
    return this.sessions.studentStats(user.id);
  }
}
