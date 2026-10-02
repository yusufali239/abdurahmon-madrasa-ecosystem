import { Module } from '@nestjs/common';
import { PaymentsBot } from './payments.bot';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsBot],
  exports: [PaymentsService],
})
export class PaymentsModule {}
