import { Context } from 'grammy';
import type { User } from '@prisma/client';

/** Контекст бота: пользователь из БД + флаг администратора */
export type BotContext = Context & {
  dbUser?: User;
  isAdmin?: boolean;
};

export type PendingHandler = (ctx: BotContext, user: User, payload: any) => Promise<void>;
