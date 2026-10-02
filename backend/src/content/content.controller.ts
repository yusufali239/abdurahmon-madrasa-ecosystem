import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Logger,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { User } from '@prisma/client';
import type { Request, Response } from 'express';
import { existsSync } from 'fs';
import { join, normalize } from 'path';
import { Readable } from 'stream';
import { CurrentUser, Roles, TelegramGuard } from '../auth/guards';
import { verifyStreamToken } from '../common/stream-token';
import { AppConfig } from '../config/app-config.service';
import { LessonsService } from '../lessons/lessons.service';
import { PrismaService } from '../prisma/prisma.service';
import { TeachersService } from '../teachers/teachers.service';
import { BUNDLED_UPLOADS, MAX_UPLOAD_BYTES, UPLOAD_ROOT, UploadsService } from '../uploads/uploads.service';
import { ContentService } from './content.service';

const TYPE_BY_MIME = (mime: string) => (mime.startsWith('audio/') ? 'AUDIO' : mime.startsWith('video/') ? 'VIDEO' : 'PDF');

@Controller()
export class ContentController {
  private readonly logger = new Logger('Content');

  constructor(
    private readonly content: ContentService,
    private readonly lessons: LessonsService,
    private readonly teachers: TeachersService,
    private readonly uploads: UploadsService,
    private readonly prisma: PrismaService,
    private readonly cfg: AppConfig,
  ) {}

  /** Загрузка контента учителем: файл (multipart) или внешняя ссылка (url) */
  @Post('lessons/:id/contents')
  @UseGuards(TelegramGuard)
  @Roles('TEACHER')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async create(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) lessonId: number,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { type?: string; title?: string; url?: string; isFree?: string | boolean; durationSec?: string; pageCount?: string },
  ) {
    const t = await this.teachers.requireTeacher(user.id);
    let url = body.url;
    let type = body.type as any;
    if (file) {
      const saved = await this.uploads.save(file, 'content');
      url = saved.url;
      type = type || TYPE_BY_MIME(file.mimetype);
    }
    if (!url || !type) throw new NotFoundException('Fayl yoki havola kerak');
    return this.content.create(
      lessonId,
      {
        type,
        title: body.title || file?.originalname || '',
        url,
        isFree: body.isFree === true || body.isFree === 'true',
        durationSec: body.durationSec ? Number(body.durationSec) : null,
        pageCount: body.pageCount ? Number(body.pageCount) : null,
      },
      t.id,
    );
  }

  @Patch('contents/:id')
  @UseGuards(TelegramGuard)
  @Roles('TEACHER')
  async update(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number, @Body() body: { title?: string; isFree?: boolean }) {
    const t = await this.teachers.requireTeacher(user.id);
    return this.content.update(id, { title: body.title, isFree: body.isFree }, t.id);
  }

  @Delete('contents/:id')
  @UseGuards(TelegramGuard)
  @Roles('TEACHER')
  async remove(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    const t = await this.teachers.requireTeacher(user.id);
    return this.content.remove(id, t.id);
  }

  /**
   * Потоковая отдача медиа с проверкой доступа по подписанному токену.
   * Локальные файлы — sendFile (Range поддерживается), внешние — проксирование с Range.
   */
  @Get('content/:id/stream')
  async stream(@Param('id', ParseIntPipe) id: number, @Query('t') token: string, @Req() req: Request, @Res() res: Response) {
    const userId = verifyStreamToken(id, token, this.cfg.jwtSecret);
    if (!userId) throw new ForbiddenException('Havola eskirgan, sahifani yangilang');
    const c = await this.content.get(id);
    if (!c.isFree) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user || !(await this.lessons.hasAccess(user, c.lesson))) throw new ForbiddenException('Bu kontent pullik');
    }

    if (c.url.startsWith('/uploads/')) {
      const rel = normalize(c.url.replace(/^\/uploads\//, ''));
      if (rel.startsWith('..')) throw new ForbiddenException();
      const path = [join(UPLOAD_ROOT, rel), join(BUNDLED_UPLOADS, rel)].find((p) => existsSync(p));
      if (!path) throw new NotFoundException('Fayl topilmadi');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      return res.sendFile(path);
    }

    try {
      const upstream = await fetch(c.url, {
        headers: req.headers.range ? { Range: String(req.headers.range) } : {},
        redirect: 'follow',
      });
      res.status(upstream.status);
      for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) {
        const v = upstream.headers.get(h);
        if (v) res.setHeader(h, v);
      }
      res.setHeader('Cache-Control', 'private, max-age=3600');
      if (!upstream.body) return res.end();
      Readable.fromWeb(upstream.body as any)
        .on('error', () => res.end())
        .pipe(res);
    } catch (e) {
      this.logger.warn(`Proksi xatosi (${c.url}): ${(e as Error).message}`);
      res.redirect(c.url);
    }
  }
}
