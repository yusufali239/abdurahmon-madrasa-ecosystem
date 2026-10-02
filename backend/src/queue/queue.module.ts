import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../config/app-config.service';
import { NotificationsService } from './notifications.service';
import { NOTIFICATIONS_QUEUE } from './queue.constants';
import { redisOptionsFromUrl } from './redis-connection';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (cfg: AppConfig) => ({ connection: redisOptionsFromUrl(cfg.redisUrl), prefix: 'madrasa' }),
    }),
    BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }),
  ],
  providers: [NotificationsService],
  exports: [NotificationsService, BullModule],
})
export class QueueModule {}
