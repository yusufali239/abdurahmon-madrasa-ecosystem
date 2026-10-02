import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NewsType } from '@prisma/client';
import { InlineKeyboard } from 'grammy';
import { esc } from '../bot/html';
import { MenuService } from '../bot/menu.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../queue/notifications.service';
import { UploadsService } from '../uploads/uploads.service';

export interface NewsInput {
  title: string;
  body: string;
  image_url?: string | null;
  type: NewsType;
}

export const NEWS_TYPE_UZ: Record<NewsType, string> = {
  TADBIR: '🎉 Tadbir',
  SPORT_FUTBOL: '⚽️ Sport / Futbol',
  ELON: '📢 E\'lon',
};

/** Новости: создание админом -> push всем студентам и учителям через очередь BullMQ */
@Injectable()
export class NewsService {
  private readonly logger = new Logger('News');

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly uploads: UploadsService,
    private readonly menu: MenuService,
  ) {}

  list(type?: NewsType, take = 50) {
    return this.prisma.news
      .findMany({ where: { type }, orderBy: { createdAt: 'desc' }, take })
      .then((rows) => rows.map((n) => ({ ...n, image_url: this.uploads.absolute(n.image_url) })));
  }

  async get(id: number) {
    const n = await this.prisma.news.findUnique({ where: { id } });
    if (!n) throw new NotFoundException('Yangilik topilmadi');
    return { ...n, image_url: this.uploads.absolute(n.image_url) };
  }

  async create(dto: NewsInput, push = true) {
    const news = await this.prisma.news.create({ data: dto });
    if (push) await this.notifications.broadcastNews(news.id);
    return news;
  }

  update(id: number, dto: Partial<NewsInput>) {
    return this.prisma.news.update({ where: { id }, data: dto });
  }

  remove(id: number) {
    return this.prisma.news.delete({ where: { id } });
  }

  push(id: number) {
    return this.notifications.broadcastNews(id);
  }

  text(n: { title: string; body: string; type: NewsType }) {
    const body = n.body.length > 700 ? `${n.body.slice(0, 700)}…` : n.body;
    return `${NEWS_TYPE_UZ[n.type]}\n\n<b>${esc(n.title)}</b>\n\n${esc(body)}`;
  }

  /** Рассылка: каждому подтверждённому студенту/учителю — отдельная задача в очереди */
  async fanOut(newsId: number) {
    const n = await this.prisma.news.findUnique({ where: { id: newsId } });
    if (!n) return 0;
    const users = await this.prisma.user.findMany({
      where: { status: 'APPROVED', role: { in: ['STUDENT', 'TEACHER', 'ADMIN'] } },
      select: { telegramId: true },
    });
    const kb = new InlineKeyboard();
    this.menu.webAppButton(kb, '📰 Barcha yangiliklar', '/news');
    kb.text('⬅️ Bosh menyu', 'menu:home');
    const image = this.uploads.absolute(n.image_url);
    const count = await this.notifications.sendMany(
      users.map((u) => u.telegramId),
      this.text(n),
      { photo: image && /^https:\/\//.test(image) ? image : undefined, reply_markup: kb },
    );
    await this.prisma.news.update({ where: { id: newsId }, data: { pushedAt: new Date(), recipients: count } });
    this.logger.log(`Yangilik #${newsId}: ${count} ta foydalanuvchiga navbatga qo'yildi`);
    return count;
  }
}
