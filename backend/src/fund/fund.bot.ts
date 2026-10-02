import { Injectable, OnModuleInit } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { BotService } from '../bot/bot.service';
import { esc, isTelegramSafeUrl } from '../bot/html';
import { MenuService } from '../bot/menu.service';
import { MessengerService } from '../bot/messenger.service';
import { formatDateUz, formatSom } from '../common/time.util';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { FundService } from './fund.service';

/** Бот: «Hayriya jamg'armasi» и отчёты */
@Injectable()
export class FundBot implements OnModuleInit {
  constructor(
    private readonly botService: BotService,
    private readonly messenger: MessengerService,
    private readonly menu: MenuService,
    private readonly fund: FundService,
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  onModuleInit() {
    const f = this.botService.features;

    f.callbackQuery('menu:fund', async (ctx) => {
      await ctx.answerCallbackQuery();
      const user = ctx.dbUser!;
      const teacher = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
      const s = await this.fund.summary(teacher?.id);
      const bar = '▓'.repeat(Math.round(s.progressPercent / 10)) + '░'.repeat(10 - Math.round(s.progressPercent / 10));
      const lines = ['🤝 <b>Hayriya jamg\'armasi</b>', ''];
      if (teacher) lines.push(`Hayriya jamg'armasi: Sizning hissangiz <b>${formatSom(s.personalTotal ?? 0)}</b>`);
      lines.push(
        `Umumiy jamg'arma: <b>${formatSom(s.globalTotal)}</b>`,
        '',
        `Tarqatildi: ${formatSom(s.distributed)}`,
        `Qoldiq: <b>${formatSom(s.available)}</b> / ${formatSom(s.limit)}`,
        `${bar} ${s.progressPercent}%`,
        '',
        `💳 Hayriya MBank: <code>${esc(s.hayriyaMbankNumber)}</code>`,
        `<i>${esc(s.recipientName)}</i>`,
      );
      const kb = new InlineKeyboard().text(`📹 Hisobotlarni ko'rish (${s.reportsCount})`, 'fund:reports').row();
      this.menu.webAppButton(kb, '💚 Hayriya qilish', '/fund');
      this.menu.backKeyboard(kb);
      await this.messenger.send(user.telegramId, lines.join('\n'), { reply_markup: kb });
    });

    f.callbackQuery('fund:reports', async (ctx) => {
      await ctx.answerCallbackQuery();
      const reports = await this.fund.reports();
      const kb = new InlineKeyboard();
      const lines = ['📹 <b>Hayriya hisobotlari</b>', ''];
      if (!reports.length) lines.push('Hozircha hisobotlar yo\'q.');
      reports.slice(0, 8).forEach((r, i) => {
        lines.push(`${i + 1}. ${formatDateUz(r.createdAt)} — <b>${formatSom(r.spentAmount)}</b>\n   ${esc(r.description)}`);
        const url = this.uploads.absolute(r.video_url)!;
        if (isTelegramSafeUrl(url)) kb.url(`▶️ ${i + 1}-hisobot videosi`, url).row();
      });
      kb.text('⬅️ Orqaga', 'menu:fund');
      await this.messenger.send(ctx.from!.id, lines.join('\n'), { reply_markup: kb });
    });
  }
}
