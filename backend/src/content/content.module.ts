import { Module } from '@nestjs/common';
import { LessonsModule } from '../lessons/lessons.module';
import { TeachersModule } from '../teachers/teachers.module';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';

@Module({
  imports: [LessonsModule, TeachersModule],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
