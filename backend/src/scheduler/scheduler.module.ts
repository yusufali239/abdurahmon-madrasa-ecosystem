import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { LessonsModule } from '../lessons/lessons.module';
import { NotificationsProcessor } from '../queue/notifications.processor';
import { LessonCronService } from './lesson-cron.service';

/** Cron-задачи и воркер очереди уведомлений */
@Module({
  imports: [ScheduleModule.forRoot(), LessonsModule],
  providers: [LessonCronService, NotificationsProcessor],
})
export class SchedulerModule {}
