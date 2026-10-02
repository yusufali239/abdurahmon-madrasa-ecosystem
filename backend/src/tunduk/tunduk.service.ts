import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../config/app-config.service';

export interface PassportVerification {
  valid: boolean;
}

/**
 * Проверка паспорта через государственную систему «Түндүк» (Кыргызстан).
 *
 * Если TUNDUK_API_URL не задан — работает MOCK:
 *   ID содержит "0000" -> { valid: false }, иначе -> { valid: true }.
 * Для перехода на реальный API достаточно указать TUNDUK_API_URL (и TUNDUK_API_KEY).
 */
@Injectable()
export class TundukService {
  private readonly logger = new Logger(TundukService.name);

  constructor(private readonly cfg: AppConfig) {}

  get isMock(): boolean {
    return !this.cfg.tundukApiUrl;
  }

  async verifyPassport(id: string): Promise<PassportVerification> {
    const passportId = TundukService.normalize(id);
    if (this.isMock) {
      return { valid: !passportId.includes('0000') };
    }
    try {
      // Реальный запрос: GET {TUNDUK_API_URL}/passport/verify?id=...
      const url = new URL('/passport/verify', this.cfg.tundukApiUrl);
      url.searchParams.set('id', passportId);
      const res = await fetch(url, {
        headers: this.cfg.tundukApiKey ? { Authorization: `Bearer ${this.cfg.tundukApiKey}` } : {},
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.logger.warn(`Tunduk javobi ${res.status}`);
        return { valid: false };
      }
      const body = (await res.json()) as { valid?: boolean };
      return { valid: Boolean(body.valid) };
    } catch (e) {
      this.logger.error(`Tunduk xatosi: ${(e as Error).message}`);
      return { valid: false };
    }
  }

  /** Нормализация: верхний регистр, без пробелов и дефисов */
  static normalize(id: string): string {
    return (id || '').toUpperCase().replace(/[\s-]+/g, '');
  }

  /** Формат: ID/AN + 7 цифр (паспорт КР) или 14-значный ПИН */
  static isWellFormed(id: string): boolean {
    const v = TundukService.normalize(id);
    return /^[A-Z]{2}\d{7}$/.test(v) || /^\d{14}$/.test(v);
  }
}
