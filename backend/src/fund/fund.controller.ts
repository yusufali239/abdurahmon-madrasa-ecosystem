import { Controller, Get, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser, TelegramGuard } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { FundService } from './fund.service';

@Controller('fund')
@UseGuards(TelegramGuard)
export class FundController {
  constructor(
    private readonly fund: FundService,
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  /** Для учителя — личный вклад + общий фонд; для студента — общий фонд */
  @Get()
  async summary(@CurrentUser() user: User) {
    const teacher = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
    return this.fund.summary(teacher?.id);
  }

  @Get('reports')
  async reports() {
    const rows = await this.fund.reports();
    return rows.map((r) => ({ ...r, video_url: this.uploads.absolute(r.video_url) }));
  }
}
