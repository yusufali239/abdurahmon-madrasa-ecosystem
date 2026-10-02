import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import { randomBytes } from 'crypto';
import Redis from 'ioredis';
import { AppConfig } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS } from '../redis/redis.module';
import { validateInitData } from './telegram-init-data';

export interface AdminJwt {
  sub: string; // telegramId
  role: 'admin';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly cfg: AppConfig,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /**
   * Пользователь Mini App по заголовку Authorization:
   *  - "tma <initData>" — подписанные данные Telegram
   *  - "dev <telegramId>" — только при ALLOW_DEV_AUTH=true (не в production)
   */
  async userFromAuthHeader(header?: string): Promise<User> {
    const [scheme, ...rest] = (header || '').split(' ');
    const value = rest.join(' ');
    let telegramId: string | null = null;
    if (scheme === 'tma') {
      const tgUser = validateInitData(value, this.cfg.botToken);
      if (tgUser) telegramId = String(tgUser.id);
    } else if (scheme === 'dev' && this.cfg.allowDevAuth && /^\d+$/.test(value)) {
      telegramId = value;
    }
    if (!telegramId) throw new UnauthorizedException('Telegram orqali kiring');
    const user = await this.prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } });
    if (!user) throw new UnauthorizedException('Avval botda ro\'yxatdan o\'ting');
    return user;
  }

  signAdmin(telegramId: string): string {
    return this.jwt.sign({ sub: telegramId, role: 'admin' } satisfies AdminJwt, { expiresIn: '7d' });
  }

  verifyAdmin(header?: string): AdminJwt {
    const [scheme, token] = (header || '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException();
    try {
      const payload = this.jwt.verify<AdminJwt>(token);
      if (payload.role !== 'admin' || !this.cfg.isAdmin(payload.sub)) throw new Error('not admin');
      return payload;
    } catch {
      throw new UnauthorizedException('Sessiya tugagan, qayta kiring');
    }
  }

  /** Одноразовая ссылка входа в админ-панель (из бота, 10 минут) */
  async createAdminLoginToken(telegramId: string): Promise<string> {
    const token = randomBytes(24).toString('base64url');
    await this.redis.set(`adminlogin:${token}`, telegramId, 'EX', 600);
    return token;
  }

  async exchangeAdminLoginToken(token: string): Promise<string> {
    const key = `adminlogin:${token}`;
    const telegramId = await this.redis.get(key);
    if (!telegramId || !this.cfg.isAdmin(telegramId)) throw new UnauthorizedException('Havola eskirgan');
    await this.redis.del(key);
    return this.signAdmin(telegramId);
  }

  adminFromInitData(initData: string): string {
    const tgUser = validateInitData(initData, this.cfg.botToken);
    if (!tgUser || !this.cfg.isAdmin(tgUser.id)) throw new UnauthorizedException('Siz admin emassiz');
    return this.signAdmin(String(tgUser.id));
  }

  devAdminLogin(): string {
    if (!this.cfg.allowDevAuth) throw new UnauthorizedException();
    return this.signAdmin(this.cfg.adminIds[0] ?? '0');
  }
}
