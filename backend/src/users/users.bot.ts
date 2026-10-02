import { Injectable, OnModuleInit } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { AuthService } from '../auth/auth.service';
import { BotService } from '../bot/bot.service';
import { BotContext } from '../bot/bot.types';
import { esc, isTelegramSafeUrl } from '../bot/html';
import { MenuService } from '../bot/menu.service';
import { MessengerService } from '../bot/messenger.service';
import { AppConfig } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

/** Обработчики бота: меню, профиль, заявки (админ), вход в админ-панель */
@Injectable()
export class UsersBot implements OnModuleInit {
  constructor(
    private readonly botService: BotService,
    private readonly messenger: MessengerService,
    private readonly menu: MenuService,
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly auth: AuthService,
    private readonly cfg: AppConfig,
  ) {}

  onModuleInit() {
    const f = this.botService.features;

    f.callbackQuery('menu:home', async (ctx) => {
      await ctx.answerCallbackQuery();
      await this.menu.show(ctx.dbUser!, ctx.isAdmin);
    });

    f.callbackQuery('menu:profile', async (ctx) => {
      await ctx.answerCallbackQuery();
      await this.showProfile(ctx);
    });

    f.command('admin', (ctx) => this.adminLink(ctx));
    f.callbackQuery('menu:admin', async (ctx) => {
      await ctx.answerCallbackQuery();
      await this.adminLink(ctx);
    });

    f.callbackQuery('menu:pending', async (ctx) => {
      await ctx.answerCallbackQuery();
      if (!ctx.isAdmin) return;
      await this.showPending(ctx);
    });

    f.callbackQuery(/^adm:(approve|reject):(\d+)$/, async (ctx) => {
      if (!ctx.isAdmin) return ctx.answerCallbackQuery({ text: 'Faqat admin uchun', show_alert: true });
      const [, action, id] = ctx.match!;
      try {
        const u = action === 'approve' ? await this.users.approve(Number(id)) : await this.users.reject(Number(id));
        await ctx.answerCallbackQuery({ text: action === 'approve' ? `✅ ${u.fullName} tasdiqlandi` : `❌ ${u.fullName} rad etildi` });
      } catch (e) {
        await ctx.answerCallbackQuery({ text: (e as Error).message, show_alert: true });
      }
      await this.showPending(ctx);
    });
  }

  private async showProfile(ctx: BotContext) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: ctx.dbUser!.id },
      include: {
        teacher: { include: { subjects: true, donationFund: true, _count: { select: { lessons: true } } } },
        _count: { select: { enrollments: true } },
      },
    });
    const lines = [
      '👤 <b>Profil</b>',
      '',
      `Ism: <b>${esc(user.fullName)}</b>`,
      `Telefon: ${esc(user.phone)}`,
      `Maqom: ${this.menu.roleName(user.role)}`,
    ];
    if (user.passportId) lines.push(`Pasport: <code>${esc(user.passportId.slice(0, 2))}•••••${esc(user.passportId.slice(-2))}</code>`);
    if (user.teacher) {
      lines.push(
        '',
        `📚 Fanlar: ${user.teacher.subjects.map((s) => esc(s.name)).join(', ') || '—'}`,
        `🗓 Darslar soni: ${user.teacher._count.lessons}`,
        `✈️ Telegram tel: ${esc(user.teacher.telegramPhone)}`,
        `💳 MBank: <code>${esc(user.teacher.mbankNumber)}</code>`,
      );
    } else {
      lines.push(`📚 Yozilgan darslar: ${user._count.enrollments}`);
    }
    const kb = new InlineKeyboard();
    this.menu.webAppButton(kb, '✏️ Profilni tahrirlash', '/profile');
    this.menu.backKeyboard(kb);
    await this.messenger.send(user.telegramId, lines.join('\n'), { reply_markup: kb });
  }

  private async showPending(ctx: BotContext) {
    const pending = await this.prisma.user.findMany({
      where: { status: 'PENDING', regStep: 'DONE' },
      orderBy: { createdAt: 'asc' },
      take: 5,
    });
    const total = await this.prisma.user.count({ where: { status: 'PENDING', regStep: 'DONE' } });
    const kb = new InlineKeyboard();
    const lines = [`⏳ <b>Kutilayotgan arizalar: ${total} ta</b>`];
    if (!pending.length) lines.push('', 'Hozircha yangi ariza yo\'q ✨');
    pending.forEach((u, i) => {
      lines.push(
        '',
        `${i + 1}. <b>${esc(u.fullName)}</b> — ${this.menu.roleName(u.role)}\n   📱 ${esc(u.phone)} · 🪪 <code>${esc(u.passportId)}</code>`,
      );
      kb.text(`✅ ${i + 1}`, `adm:approve:${u.id}`).text(`❌ ${i + 1}`, `adm:reject:${u.id}`).row();
    });
    this.menu.backKeyboard(kb);
    await this.messenger.send(ctx.from!.id, lines.join('\n'), { reply_markup: kb });
  }

  private async adminLink(ctx: BotContext) {
    if (!ctx.isAdmin) {
      return this.messenger.send(ctx.from!.id, '⛔️ Bu bo\'lim faqat adminlar uchun.', {
        reply_markup: this.menu.backKeyboard(),
      });
    }
    const token = await this.auth.createAdminLoginToken(String(ctx.from!.id));
    const url = `${this.cfg.adminUrl}/login?token=${token}`;
    const kb = new InlineKeyboard();
    if (isTelegramSafeUrl(url)) kb.url('🛠 Admin panelni ochish', url).row();
    this.menu.backKeyboard(kb);
    await this.messenger.send(
      ctx.from!.id,
      `🛠 <b>Admin panel</b>\n\nBir martalik kirish havolasi (10 daqiqa amal qiladi):\n${esc(url)}`,
      { reply_markup: kb },
    );
  }
}
