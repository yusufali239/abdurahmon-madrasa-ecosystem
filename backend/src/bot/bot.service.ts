import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { Api, Bot, Composer, GrammyError, HttpError } from 'grammy';
import { AppConfig } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { BotContext, PendingHandler, PendingReprompt } from './bot.types';

/**
 * Обёртка над grammY.
 * Порядок middleware: загрузка пользователя -> core (регистрация) -> ожидаемые действия -> features.
 * Модули добавляют обработчики в `core`/`features` в onModuleInit, бот стартует в onApplicationBootstrap.
 */
@Injectable()
export class BotService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('Bot');
  readonly bot: Bot<BotContext> | null;
  /** Регистрация и «шлюз» для неподтверждённых пользователей */
  readonly core = new Composer<BotContext>();
  /** Функциональные обработчики (уроки, посещаемость, новости...) */
  readonly features = new Composer<BotContext>();
  private readonly pending = new Map<string, { handler: PendingHandler; reprompt?: PendingReprompt }>();

  constructor(
    private readonly cfg: AppConfig,
    private readonly prisma: PrismaService,
  ) {
    if (!cfg.botToken) {
      this.bot = null;
      this.logger.warn('BOT_TOKEN berilmagan — bot o\'chirilgan, API ishlashda davom etadi.');
      return;
    }
    this.bot = new Bot<BotContext>(cfg.botToken);
    const bot = this.bot;

    // Только личные чаты
    bot.use(async (ctx, next) => {
      if (ctx.chat && ctx.chat.type !== 'private') return;
      await next();
    });

    bot.use((ctx, next) => this.loadUser(ctx, next));
    // Ленивое подключение: обработчики могут добавляться после bot.use()
    bot.use((ctx, next) => this.core.middleware()(ctx, next));
    bot.use((ctx, next) => this.dispatchPending(ctx, next));
    bot.use((ctx, next) => this.features.middleware()(ctx, next));

    // Неизвестные callback — снять «часики»
    bot.on('callback_query', (ctx) => ctx.answerCallbackQuery().catch(() => undefined));

    bot.catch((err) => {
      const e = err.error;
      if (e instanceof GrammyError) this.logger.error(`Telegram xatosi: ${e.description}`);
      else if (e instanceof HttpError) this.logger.error(`Tarmoq xatosi: ${e}`);
      else this.logger.error(`Bot xatosi: ${(e as Error)?.stack || e}`);
    });
  }

  get enabled(): boolean {
    return !!this.bot;
  }

  get api(): Api | null {
    return this.bot?.api ?? null;
  }

  /**
   * Обработчик текста, когда у пользователя установлен pendingAction.
   * Если задан reprompt — действие обязательное: любые другие апдейты возвращают к вопросу.
   */
  onPendingAction(action: string, handler: PendingHandler, reprompt?: PendingReprompt) {
    this.pending.set(action, { handler, reprompt });
  }

  async setPending(userId: number, action: string | null, payload: unknown = null) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { pendingAction: action, pendingPayload: (payload ?? undefined) as any },
    });
  }

  private async loadUser(ctx: BotContext, next: () => Promise<void>) {
    if (!ctx.from) return next();
    const telegramId = BigInt(ctx.from.id);
    ctx.isAdmin = this.cfg.isAdmin(ctx.from.id);
    let user = await this.prisma.user.findUnique({ where: { telegramId } });
    if (!user) {
      const name = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ');
      user = await this.prisma.user.create({
        data: ctx.isAdmin
          ? {
              telegramId,
              username: ctx.from.username,
              fullName: name || 'Admin',
              role: 'ADMIN',
              status: 'APPROVED',
              regStep: 'DONE',
              approvedAt: new Date(),
            }
          : { telegramId, username: ctx.from.username },
      });
    } else if (ctx.isAdmin && (user.regStep !== 'DONE' || user.status !== 'APPROVED')) {
      // Администратор из ADMIN_IDS не проходит регистрацию
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          regStep: 'DONE',
          status: 'APPROVED',
          fullName: user.fullName || ctx.from.first_name || 'Admin',
          role: user.role === 'STUDENT' ? 'ADMIN' : user.role,
        },
      });
    }
    ctx.dbUser = user;
    try {
      await next();
    } finally {
      // Чистый чат: удаляем и входящие сообщения пользователя
      if (ctx.message) await ctx.deleteMessage().catch(() => undefined);
    }
  }

  private async dispatchPending(ctx: BotContext, next: () => Promise<void>) {
    const user = ctx.dbUser;
    const text = ctx.message?.text;
    const entry = user?.pendingAction ? this.pending.get(user.pendingAction) : undefined;
    if (!user || !entry) return next();
    if (text && !text.startsWith('/')) return entry.handler(ctx, user, user.pendingPayload);
    if (entry.reprompt) {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: 'Avval so\'ralgan ma\'lumotni yozing', show_alert: true }).catch(() => undefined);
      }
      await entry.reprompt(ctx, user, user.pendingPayload);
      return;
    }
    return next();
  }

  async onApplicationBootstrap() {
    if (!this.bot) return;
    try {
      await this.bot.init();
      await this.bot.api.setMyCommands([
        { command: 'start', description: 'Bosh menyu' },
        { command: 'bugun', description: 'Bugungi darslar' },
        { command: 'davomat', description: 'Davomat (ustozlar uchun)' },
        { command: 'admin', description: 'Admin panelga kirish' },
      ]);
      if (this.cfg.botWebhookUrl) {
        await this.bot.api.setWebhook(this.cfg.botWebhookUrl, {
          secret_token: this.cfg.botWebhookSecret,
          allowed_updates: ['message', 'callback_query'],
        });
        this.logger.log(`Webhook o'rnatildi: ${this.cfg.botWebhookUrl}`);
      } else {
        await this.bot.api.deleteWebhook().catch(() => undefined);
        void this.bot.start({
          allowed_updates: ['message', 'callback_query'],
          onStart: (me) => this.logger.log(`@${me.username} long-polling rejimida ishga tushdi`),
        });
      }
    } catch (e) {
      this.logger.error(`Botni ishga tushirib bo'lmadi: ${(e as Error).message}`);
    }
  }

  async onModuleDestroy() {
    if (this.bot?.isRunning()) await this.bot.stop();
  }
}
