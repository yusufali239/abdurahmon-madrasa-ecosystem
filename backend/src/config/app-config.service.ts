import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Типизированный доступ к переменным окружения.
 * Все значения читаются из корневого .env (см. .env.example).
 */
@Injectable()
export class AppConfig {
  constructor(private readonly cfg: ConfigService) {}

  private str(key: string, def = ''): string {
    const v = this.cfg.get<string>(key);
    return v === undefined || v === null || v === '' ? def : String(v);
  }

  get isProd() {
    return this.str('NODE_ENV') === 'production';
  }
  get port() {
    return Number(this.str('PORT', '3000'));
  }
  get timezone() {
    return this.str('TZ_NAME', 'Asia/Bishkek');
  }
  get publicApiUrl() {
    return this.str('PUBLIC_API_URL', `http://localhost:${this.port}`).replace(/\/$/, '');
  }
  get botToken() {
    return this.str('BOT_TOKEN');
  }
  get botUsername() {
    return this.str('BOT_USERNAME', 'abdurahmon_madrasa_bot');
  }
  get botWebhookUrl() {
    return this.str('BOT_WEBHOOK_URL');
  }
  get botWebhookSecret() {
    return this.str('BOT_WEBHOOK_SECRET', 'webhook-secret');
  }
  /** ADMIN_IDS (или ADMIN_TELEGRAM_IDS) — список Telegram ID через запятую */
  get adminIds(): string[] {
    const raw = this.str('ADMIN_IDS') || this.str('ADMIN_TELEGRAM_IDS');
    return raw
      .split(/[,\s;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  isAdmin(telegramId: number | bigint | string | undefined | null): boolean {
    if (telegramId === undefined || telegramId === null) return false;
    return this.adminIds.includes(String(telegramId));
  }
  get redisUrl() {
    return this.str('REDIS_URL', 'redis://localhost:6379');
  }
  get tundukApiUrl() {
    return this.str('TUNDUK_API_URL');
  }
  get tundukApiKey() {
    return this.str('TUNDUK_API_KEY');
  }
  get hayriyaMbankNumber() {
    return this.str('HAYRIYA_MBANK_NUMBER', '+996700000000');
  }
  get hayriyaRecipientName() {
    return this.str('HAYRIYA_RECIPIENT_NAME', 'Abdurahmon ibn Avf madrasasi');
  }
  get donationLimitDefault() {
    return Number(this.str('DONATION_LIMIT', '20000'));
  }
  get jwtSecret() {
    return this.str('JWT_SECRET', 'dev-secret-change-me');
  }
  get allowDevAuth() {
    return !this.isProd && this.str('ALLOW_DEV_AUTH', 'false') === 'true';
  }
  get miniAppUrl() {
    return this.str('MINIAPP_URL', 'http://localhost:5173').replace(/\/$/, '');
  }
  get adminUrl() {
    return this.str('ADMIN_URL', 'http://localhost:5174').replace(/\/$/, '');
  }
}
