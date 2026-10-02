import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { User } from '@prisma/client';
import { CurrentUser, Roles, TelegramGuard } from '../auth/guards';
import { PaymentsService } from './payments.service';

const RECEIPT_LIMIT = { limits: { fileSize: 15 * 1024 * 1024 } };

@Controller()
@UseGuards(TelegramGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('payments/info')
  info(@CurrentUser() user: User, @Query('lessonId', ParseIntPipe) lessonId: number) {
    return this.payments.info(user, lessonId);
  }

  /** Оплата одного дня урока: multipart (lessonId, date YYYY-MM-DD, receipt — фото/PDF чека) */
  @Post('payments')
  @UseInterceptors(FileInterceptor('receipt', RECEIPT_LIMIT))
  create(
    @CurrentUser() user: User,
    @Body() body: { lessonId: string; date?: string; note?: string },
    @UploadedFile() receipt?: Express.Multer.File,
  ) {
    return this.payments.createForLesson(user, Number(body.lessonId), body.date, receipt, body.note);
  }

  /** Пожертвование в фонд Hayriya (teacherId, amount, receipt) */
  @Post('donations')
  @UseInterceptors(FileInterceptor('receipt', RECEIPT_LIMIT))
  donate(
    @CurrentUser() user: User,
    @Body() body: { teacherId: string; amount: string; note?: string },
    @UploadedFile() receipt?: Express.Multer.File,
  ) {
    return this.payments.createDonation(user, Number(body.teacherId), Number(body.amount), receipt, body.note);
  }

  @Get('payments/mine')
  mine(@CurrentUser() user: User) {
    return this.payments.mine(user);
  }

  @Get('payments/teacher')
  @Roles('TEACHER')
  teacher(@CurrentUser() user: User) {
    return this.payments.forTeacher(user.id);
  }

  @Post('payments/:id/confirm')
  @Roles('TEACHER')
  confirm(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.payments.confirm(id, { kind: 'teacher', userId: user.id });
  }

  @Post('payments/:id/reject')
  @Roles('TEACHER')
  reject(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string }) {
    return this.payments.reject(id, { kind: 'teacher', userId: user.id }, body?.reason);
  }
}
