import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentType } from '@prisma/client';
import { LessonsService } from '../lessons/lessons.service';
import { PrismaService } from '../prisma/prisma.service';

export interface ContentInput {
  type: ContentType;
  title: string;
  url: string;
  isFree?: boolean;
  durationSec?: number | null;
  pageCount?: number | null;
}

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lessons: LessonsService,
  ) {}

  async create(lessonId: number, dto: ContentInput, teacherId?: number) {
    const lesson = await this.lessons.findOrThrow(lessonId);
    if (teacherId && lesson.teacherId !== teacherId) throw new ForbiddenException('Bu sizning darsingiz emas');
    return this.prisma.lessonContent.create({
      data: {
        lessonId,
        type: dto.type,
        title: dto.title || '',
        url: dto.url,
        isFree: !!dto.isFree,
        durationSec: dto.durationSec ?? null,
        pageCount: dto.pageCount ?? null,
      },
    });
  }

  async update(id: number, dto: Partial<ContentInput>, teacherId?: number) {
    await this.own(id, teacherId);
    return this.prisma.lessonContent.update({ where: { id }, data: dto });
  }

  async remove(id: number, teacherId?: number) {
    await this.own(id, teacherId);
    return this.prisma.lessonContent.delete({ where: { id } });
  }

  async get(id: number) {
    const c = await this.prisma.lessonContent.findUnique({ where: { id }, include: { lesson: true } });
    if (!c) throw new NotFoundException('Kontent topilmadi');
    return c;
  }

  private async own(id: number, teacherId?: number) {
    const c = await this.get(id);
    if (teacherId && c.lesson.teacherId !== teacherId) throw new ForbiddenException('Bu sizning darsingiz emas');
    return c;
  }
}
