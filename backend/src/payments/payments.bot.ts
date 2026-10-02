import { Injectable, OnModuleInit } from '@nestjs/common';
import { BotService } from '../bot/bot.service';
import { PaymentActor, PaymentsService } from './payments.service';

/** Кнопки подтверждения платежа для админа и учителя */
@Injectable()
export class PaymentsBot implements OnModuleInit {
  constructor(
    private readonly botService: BotService,
    private readonly payments: PaymentsService,
  ) {}

  onModuleInit() {
    this.botService.features.callbackQuery(/^pay:(ok|no):(\d+)$/, async (ctx) => {
      const [, action, id] = ctx.match!;
      const actor: PaymentActor = ctx.isAdmin
        ? { kind: 'admin', telegramId: String(ctx.from.id) }
        : { kind: 'teacher', userId: ctx.dbUser!.id };
      try {
        const p = action === 'ok' ? await this.payments.confirm(Number(id), actor) : await this.payments.reject(Number(id), actor);
        await ctx.answerCallbackQuery({ text: p.status === 'CONFIRMED' ? `✅ #${id} tasdiqlandi` : `❌ #${id} rad etildi` });
        await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => undefined);
        await ctx.editMessageText(
          `${p.status === 'CONFIRMED' ? '✅' : '❌'} To'lov #${id} — ${p.student.fullName}, ${p.amount} som: ${p.status === 'CONFIRMED' ? 'tasdiqlandi' : 'rad etildi'}`,
        ).catch(() => undefined);
      } catch (e) {
        await ctx.answerCallbackQuery({ text: (e as Error).message, show_alert: true });
      }
    });
  }
}
