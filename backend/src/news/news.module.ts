import { Global, Module } from '@nestjs/common';
import { NewsBot } from './news.bot';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';

@Global()
@Module({
  controllers: [NewsController],
  providers: [NewsService, NewsBot],
  exports: [NewsService],
})
export class NewsModule {}
