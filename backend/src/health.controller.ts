import { Controller, Get } from '@nestjs/common';
import { BotService } from './bot/bot.service';
import { PrismaService } from './prisma/prisma.service';
import { TundukService } from './tunduk/tunduk.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bot: BotService,
    private readonly tunduk: TundukService,
  ) {}

  @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true, bot: this.bot.enabled, tundukMock: this.tunduk.isMock, time: new Date().toISOString() };
  }
}
