import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** "example.onrender.com" -> "https://example.onrender.com" (хостинг часто отдаёт только host) */
export function withProtocol(url: string): string {
  const v = url.trim().replace(/\/$/, '');
  if (!v) return v;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

/**
 * Исправляет частую ошибку: в REDIS_URL вставлена вся команда
 * "redis-cli --tls -u redis://..." вместо одного адреса.
 */
export function normalizeRedisUrl(raw: string): string {
  let v = raw.trim();
  const tls = /--tls\b/.test(v);
  const m = v.match(/rediss?:\/\/\S+/);
  if (m) v = m[0];
  if (tls) v = v.replace(/^redis:\/\//, 'rediss://');
  return v;
}

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
    // На Render адрес сервиса доступен в RENDER_EXTERNAL_URL
    return withProtocol(this.str('PUBLIC_API_URL') || this.str('RENDER_EXTERNAL_URL') || `http://localhost:${this.port}`);
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
    return normalizeRedisUrl(this.str('REDIS_URL', 'redis://localhost:6379'));
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
  /** Необязательная ссылка на перевод в MBank для фонда */
  get hayriyaMbankLink() {
    return this.str('HAYRIYA_MBANK_LINK');
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
    // Без MINIAPP_URL на хостинге: Mini App раздаётся backend'ом по адресу /app
    return withProtocol(this.str('MINIAPP_URL') || (this.isHosted ? `${this.publicApiUrl}/app` : 'http://localhost:5173'));
  }
  get adminUrl() {
    return withProtocol(this.str('ADMIN_URL') || (this.isHosted ? `${this.publicApiUrl}/admin` : 'http://localhost:5174'));
  }
  /** Задан публичный https-адрес backend'а (PUBLIC_API_URL или RENDER_EXTERNAL_URL) */
  get isHosted() {
    return /^https:\/\//.test(this.publicApiUrl);
  }
}
