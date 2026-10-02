import { Injectable, OnModuleInit } from '@nestjs/common';
import type { User } from '@prisma/client';
import { InlineKeyboard, Keyboard } from 'grammy';
import { PrismaService } from '../../prisma/prisma.service';
import { TundukService } from '../../tunduk/tunduk.service';
import { AdminNotifier } from '../admin-notifier.service';
import { BotService } from '../bot.service';
import { BotContext } from '../bot.types';
import { esc } from '../html';
import { MenuService } from '../menu.service';
import { MessengerService } from '../messenger.service';

const NAME_RE = /^[A-Za-zА-Яа-яЁёЎўҚқҒғҲҳʻʼ'‘’`\- ]+$/;

/**
 * Регистрация: /start -> паспорт (проверка Түндүк) -> контакт -> ФИО -> роль -> PENDING.
 * Также «шлюз»: пока пользователь не подтверждён админом, остальные функции недоступны.
 */
@Injectable()
export class RegistrationHandler implements OnModuleInit {
  constructor(
    private readonly botService: BotService,
    private readonly messenger: MessengerService,
    private readonly prisma: PrismaService,
    private readonly tunduk: TundukService,
    private readonly menu: MenuService,
    private readonly admins: AdminNotifier,
  ) {}

  onModuleInit() {
    const c = this.botService.core;

    c.callbackQuery(/^reg:role:(STUDENT|TEACHER)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const user = ctx.dbUser!;
      if (user.regStep !== 'ROLE') return this.prompt(user);
      const role = ctx.match![1] as 'STUDENT' | 'TEACHER';
      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: { role, regStep: 'DONE', status: 'PENDING' },
      });
      await this.prompt(updated);
      await this.notifyAdmins(updated);
    });

    c.callbackQuery('reg:restart', async (ctx) => {
      await ctx.answerCallbackQuery();
      const user = ctx.dbUser!;
      if (user.status !== 'REJECTED') return;
      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: { regStep: 'PASSPORT', status: 'PENDING', passportId: null },
      });
      await this.prompt(updated);
    });

    // Шлюз: незавершённая регистрация или неподтверждённый пользователь
    c.use(async (ctx, next) => {
      const user = ctx.dbUser;
      if (!user) return;
      if (user.regStep !== 'DONE') return this.handleStep(ctx, user);
      if (user.status !== 'APPROVED') {
        if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => undefined);
        return this.prompt(user);
      }
      if (ctx.message?.text === '/start') {
        await this.botService.setPending(user.id, null);
        return this.menu.show(user, ctx.isAdmin);
      }
      return next();
    });
  }

  private async handleStep(ctx: BotContext, user: User) {
    const text = ctx.message?.text?.trim();
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => undefined);

    if (!text?.startsWith('/') || text === undefined) {
      switch (user.regStep) {
        case 'PASSPORT':
          if (text) return this.onPassport(user, text);
          break;
        case 'CONTACT':
          if (ctx.message?.contact) return this.onContact(ctx, user);
          break;
        case 'FULL_NAME':
          if (text) return this.onFullName(user, text);
          break;
      }
    }
    return this.prompt(user);
  }

  private async onPassport(user: User, raw: string) {
    const passportId = TundukService.normalize(raw);
    if (!TundukService.isWellFormed(passportId)) {
      return this.prompt(user, '⚠️ Pasport raqami noto\'g\'ri formatda. Masalan: <code>ID1234567</code> yoki 14 xonali PIN.');
    }
    const { valid } = await this.tunduk.verifyPassport(passportId);
    if (!valid) {
      return this.prompt(user, '❌ Pasport Tunduk tizimida tasdiqlanmadi. Raqamni tekshirib, qayta yuboring.');
    }
    const taken = await this.prisma.user.findFirst({ where: { passportId, NOT: { id: user.id } } });
    if (taken) {
      return this.prompt(user, '⚠️ Bu pasport bilan allaqachon ro\'yxatdan o\'tilgan. Admin bilan bog\'laning.');
    }
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { passportId, regStep: 'CONTACT' },
    });
    return this.prompt(updated, '✅ Pasport tasdiqlandi.');
  }

  private async onContact(ctx: BotContext, user: User) {
    const contact = ctx.message!.contact!;
    if (contact.user_id !== ctx.from!.id) {
      return this.prompt(user, '⚠️ Iltimos, faqat <b>o\'zingizning</b> raqamingizni yuboring (pastdagi tugma orqali).');
    }
    const phone = contact.phone_number.startsWith('+') ? contact.phone_number : `+${contact.phone_number}`;
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { phone, regStep: 'FULL_NAME' },
    });
    return this.prompt(updated, '✅ Telefon raqam qabul qilindi.');
  }

  private async onFullName(user: User, raw: string) {
    const name = raw.replace(/\s+/g, ' ').trim();
    const words = name.split(' ');
    if (!NAME_RE.test(name) || words.length < 2 || name.length < 5 || name.length > 80) {
      return this.prompt(user, '⚠️ Familiya va ismingizni to\'liq yozing. Masalan: <i>Karimov Sardor</i>');
    }
    const fullName = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { fullName, regStep: 'ROLE' },
    });
    return this.prompt(updated);
  }

  /** Сообщение текущего шага (через «чистый чат») */
  async prompt(user: User, notice?: string) {
    const head = notice ? `${notice}\n\n` : '';
    switch (user.regStep) {
      case 'PASSPORT':
        return this.messenger.send(
          user.telegramId,
          `${head}🕌 <b>Abdurahmon ibn Avf madrasasiga xush kelibsiz!</b>\n\n` +
            `Ro'yxatdan o'tish — <b>1/4</b>\n\n🪪 Pasport ID raqamingizni yuboring.\nMasalan: <code>ID1234567</code>\n\n` +
            `<i>Ma'lumotlaringiz Tunduk tizimi orqali tekshiriladi va maxfiy saqlanadi.</i>`,
        );
      case 'CONTACT':
        return this.messenger.send(
          user.telegramId,
          `${head}Ro'yxatdan o'tish — <b>2/4</b>\n\n📱 Pastdagi tugmani bosib, telefon raqamingizni ulashing.`,
          { reply_markup: new Keyboard().requestContact('📱 Raqamni ulashish').resized().oneTime() },
        );
      case 'FULL_NAME':
        return this.messenger.send(
          user.telegramId,
          `${head}Ro'yxatdan o'tish — <b>3/4</b>\n\n✍️ Familiya va ismingizni yozing.\nMasalan: <i>Karimov Sardor</i>`,
          { reply_markup: { remove_keyboard: true } },
        );
      case 'ROLE':
        return this.messenger.send(
          user.telegramId,
          `${head}Ro'yxatdan o'tish — <b>4/4</b>\n\n👤 <b>${esc(user.fullName)}</b>, siz madrasada kimsiz?`,
          { reply_markup: new InlineKeyboard().text('🎓 Talaba', 'reg:role:STUDENT').text('📖 Ustoz', 'reg:role:TEACHER') },
        );
      case 'DONE':
        if (user.status === 'PENDING') {
          return this.messenger.send(
            user.telegramId,
            `${head}⏳ <b>Arizangiz qabul qilindi!</b>\n\n👤 ${esc(user.fullName)}\n📱 ${esc(user.phone)}\n🎓 ${this.menu.roleName(user.role)}\n\n` +
              `Admin tasdiqlagandan so'ng sizga xabar beramiz. Jazakallohu xoyron!`,
          );
        }
        if (user.status === 'REJECTED') {
          return this.messenger.send(
            user.telegramId,
            `${head}❌ Arizangiz rad etildi. Ma'lumotlarni tekshirib, qayta ariza yuborishingiz mumkin.`,
            { reply_markup: new InlineKeyboard().text('🔁 Qayta ariza berish', 'reg:restart') },
          );
        }
        if (user.status === 'BLOCKED') {
          return this.messenger.send(user.telegramId, `${head}⛔️ Hisobingiz bloklangan. Admin bilan bog'laning.`);
        }
        return;
    }
  }

  private async notifyAdmins(user: User) {
    const pending = await this.prisma.user.count({ where: { status: 'PENDING', regStep: 'DONE' } });
    const kb = new InlineKeyboard()
      .text('✅ Tasdiqlash', `adm:approve:${user.id}`)
      .text('❌ Rad etish', `adm:reject:${user.id}`)
      .row()
      .text('⏳ Barcha arizalar', 'menu:pending');
    await this.admins.notify(
      `🆕 <b>Yangi ariza</b> (kutilmoqda: ${pending} ta)\n\n` +
        `👤 ${esc(user.fullName)}\n🎓 ${this.menu.roleName(user.role)}\n📱 ${esc(user.phone)}\n🪪 <code>${esc(user.passportId)}</code>` +
        (user.username ? `\n✈️ @${esc(user.username)}` : ''),
      kb,
    );
  }
}
