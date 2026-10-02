import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { AppConfig } from '../config/app-config.service';

export const UPLOAD_ROOT = join(process.cwd(), 'uploads');
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

const ALLOWED = /^(image\/(png|jpe?g|webp|gif|heic)|audio\/(mpeg|mp3|mp4|aac|ogg|wav|x-m4a|webm)|video\/(mp4|webm|quicktime)|application\/pdf)$/;

export type UploadKind = 'receipts' | 'content' | 'news' | 'reports';

/** Локальное хранилище файлов (uploads/), раздаётся статически по /uploads/... */
@Injectable()
export class UploadsService {
  constructor(private readonly cfg: AppConfig) {}

  async save(file: Express.Multer.File | undefined, kind: UploadKind): Promise<{ url: string; absoluteUrl: string; mime: string; size: number }> {
    if (!file) throw new BadRequestException('Fayl yuborilmadi');
    if (!ALLOWED.test(file.mimetype)) throw new BadRequestException(`Bu fayl turi qo'llab-quvvatlanmaydi: ${file.mimetype}`);
    const now = new Date();
    const dir = join(kind, `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`);
    await mkdir(join(UPLOAD_ROOT, dir), { recursive: true });
    const ext = (extname(file.originalname) || '').toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 6) || '';
    const name = `${randomBytes(12).toString('hex')}${ext}`;
    await writeFile(join(UPLOAD_ROOT, dir, name), file.buffer);
    const url = `/uploads/${dir.replace(/\\/g, '/')}/${name}`;
    return { url, absoluteUrl: this.absolute(url)!, mime: file.mimetype, size: file.size };
  }

  /** Относительный путь -> абсолютный URL (для Telegram и фронтенда) */
  absolute(url: string | null | undefined): string | null {
    if (!url) return null;
    return url.startsWith('/') ? `${this.cfg.publicApiUrl}${url}` : url;
  }
}
