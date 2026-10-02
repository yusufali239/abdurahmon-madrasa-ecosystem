import { Module } from '@nestjs/common';
import { TeachersModule } from '../teachers/teachers.module';
import { LessonsBot } from './lessons.bot';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';
import { SessionsService } from './sessions.service';

@Module({
  imports: [TeachersModule],
  controllers: [LessonsController],
  providers: [LessonsService, SessionsService, LessonsBot],
  exports: [LessonsService, SessionsService],
})
export class LessonsModule {}
