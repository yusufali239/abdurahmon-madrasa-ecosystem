import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { User } from '@prisma/client';
import { AppConfig } from '../config/app-config.service';
import { AuthService } from './auth.service';

export const ALLOW_PENDING = 'allowPending';
/** Разрешить доступ неподтверждённым пользователям (например, /me) */
export const AllowPending = () => SetMetadata(ALLOW_PENDING, true);
export const ROLES = 'roles';
export const Roles = (...roles: Array<'STUDENT' | 'TEACHER' | 'ADMIN'>) => SetMetadata(ROLES, roles);

/** Guard Mini App: проверяет initData и кладёт пользователя в req.user */
@Injectable()
export class TelegramGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
    private readonly cfg: AppConfig,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const user = await this.auth.userFromAuthHeader(req.headers.authorization);
    const allowPending = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING, [ctx.getHandler(), ctx.getClass()]);
    if (!allowPending && user.status !== 'APPROVED') {
      throw new ForbiddenException('Hisobingiz hali tasdiqlanmagan');
    }
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    const isAdmin = this.cfg.isAdmin(String(user.telegramId));
    if (roles?.length && !roles.includes(user.role) && !(isAdmin && roles.includes('ADMIN'))) {
      throw new ForbiddenException('Bu amal uchun huquqingiz yo\'q');
    }
    req.user = user;
    req.isAdmin = isAdmin;
    return true;
  }
}

/** Guard админ-панели: JWT Bearer */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    req.admin = this.auth.verifyAdmin(req.headers.authorization);
    return true;
  }
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): User => {
  return ctx.switchToHttp().getRequest().user;
});
