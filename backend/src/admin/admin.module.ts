import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { LessonsModule } from '../lessons/lessons.module';
import { PaymentsModule } from '../payments/payments.module';
import { SubjectsModule } from '../subjects/subjects.module';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [UsersModule, LessonsModule, SubjectsModule, PaymentsModule, ContentModule],
  controllers: [AdminController],
})
export class AdminModule {}
