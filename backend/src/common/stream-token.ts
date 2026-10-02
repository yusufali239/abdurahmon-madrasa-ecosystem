import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Короткоживущая подпись для ссылок на медиа (<audio>/<video>/PDF не умеют слать заголовки).
 * token = exp.hmac(contentId:userId:exp)
 */
export function signStreamToken(contentId: number, userId: number, secret: string, ttlSec = 6 * 3600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = createHmac('sha256', secret).update(`${contentId}:${userId}:${exp}`).digest('base64url');
  return `${userId}.${exp}.${sig}`;
}

export function verifyStreamToken(contentId: number, token: string, secret: string): number | null {
  const [userId, exp, sig] = (token || '').split('.');
  if (!userId || !exp || !sig || Number(exp) < Date.now() / 1000) return null;
  const calc = createHmac('sha256', secret).update(`${contentId}:${userId}:${exp}`).digest('base64url');
  const a = Buffer.from(calc);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return Number(userId);
}
