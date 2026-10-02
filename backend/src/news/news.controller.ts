import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { NewsType } from '@prisma/client';
import { TelegramGuard } from '../auth/guards';
import { NewsService } from './news.service';

@Controller('news')
@UseGuards(TelegramGuard)
export class NewsController {
  constructor(private readonly news: NewsService) {}

  @Get()
  list(@Query('type') type?: NewsType) {
    return this.news.list(type && type in { TADBIR: 1, SPORT_FUTBOL: 1, ELON: 1 } ? type : undefined);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.news.get(id);
  }
}
