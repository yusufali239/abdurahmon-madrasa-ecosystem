import { Injectable, OnModuleInit } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { BotService } from '../bot/bot.service';
import { esc } from '../bot/html';
import { MenuService } from '../bot/menu.service';
import { MessengerService } from '../bot/messenger.service';
import { formatDateUz } from '../common/time.util';
import { NEWS_TYPE_UZ, NewsService } from './news.service';

@Injectable()
export class NewsBot implements OnModuleInit {
  constructor(
    private readonly botService: BotService,
    private readonly messenger: MessengerService,
    private readonly menu: MenuService,
    private readonly news: NewsService,
  ) {}

  onModuleInit() {
    this.botService.features.callbackQuery('menu:news', async (ctx) => {
      await ctx.answerCallbackQuery();
      const items = await this.news.list(undefined, 5);
      const kb = new InlineKeyboard();
      const lines = ['📰 <b>Yangiliklar</b>', ''];
      if (!items.length) lines.push('Hozircha yangiliklar yo\'q.');
      items.forEach((n, i) => {
        lines.push(`${NEWS_TYPE_UZ[n.type]} · ${formatDateUz(n.createdAt)}\n<b>${esc(n.title)}</b>`, '');
        kb.text(`${i + 1}. ${n.title.slice(0, 30)}`, `news:${n.id}`).row();
      });
      this.menu.webAppButton(kb, '📱 Ilovada ochish', '/news');
      this.menu.backKeyboard(kb);
      await this.messenger.send(ctx.from.id, lines.join('\n'), { reply_markup: kb });
    });

    this.botService.features.callbackQuery(/^news:(\d+)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const n = await this.news.get(Number(ctx.match![1]));
      const kb = new InlineKeyboard().text('⬅️ Yangiliklar', 'menu:news').text('🏠 Menyu', 'menu:home');
      await this.messenger.send(ctx.from.id, this.news.text(n), {
        photo: n.image_url && /^https:\/\//.test(n.image_url) ? n.image_url : undefined,
        reply_markup: kb,
      });
    });
  }
}
