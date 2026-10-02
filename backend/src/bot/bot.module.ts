import { Global, Module } from '@nestjs/common';
import { AdminNotifier } from './admin-notifier.service';
import { BotService } from './bot.service';
import { BotWebhookController } from './bot-webhook.controller';
import { RegistrationHandler } from './handlers/registration.handler';
import { MenuService } from './menu.service';
import { MessengerService } from './messenger.service';

@Global()
@Module({
  controllers: [BotWebhookController],
  providers: [BotService, MessengerService, MenuService, AdminNotifier, RegistrationHandler],
  exports: [BotService, MessengerService, MenuService, AdminNotifier, RegistrationHandler],
})
export class BotModule {}
