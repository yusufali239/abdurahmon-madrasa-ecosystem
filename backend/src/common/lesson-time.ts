import { computePrayerTimes, PrayerTimes } from './prayer-times';
import { TZ, zonedToUtc } from './time.util';

/** Отступ «после намаза» (минуты) — время на сам намаз */
const AFTER_PRAYER_OFFSET = 15;
const BEFORE_PRAYER_OFFSET = -30;

const PRAYER_KEYWORDS: Array<{ re: RegExp; key: keyof PrayerTimes }> = [
  { re: /bomdod|fajr|bamdod/i, key: 'bomdod' },
  { re: /peshin|zuhr|zohr|pishin/i, key: 'peshin' },
  { re: /asr/i, key: 'asr' },
  { re: /shom|magrib|maghrib/i, key: 'shom' },
  { re: /xufton|hufton|isha|xuftan/i, key: 'xufton' },
];

/**
 * Возвращает минуты от полуночи для начала урока.
 * Приоритет: startClock "HH:mm" -> время в startTime -> время намаза по ключевому слову.
 */
export function resolveStartMinutes(
  lesson: { startClock?: string | null; startTime: string },
  date: { year: number; month: number; day: number },
): number | null {
  const clock = (lesson.startClock || '').match(/^(\d{1,2})[:.](\d{2})$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);

  const inline = lesson.startTime.match(/(\d{1,2})[:.](\d{2})/);
  if (inline) return Number(inline[1]) * 60 + Number(inline[2]);

  const prayer = PRAYER_KEYWORDS.find((p) => p.re.test(lesson.startTime));
  if (prayer) {
    const times = computePrayerTimes(date.year, date.month, date.day);
    const before = /oldin|avval/i.test(lesson.startTime);
    return times[prayer.key] + (before ? BEFORE_PRAYER_OFFSET : AFTER_PRAYER_OFFSET);
  }
  return null;
}

export function resolveStartsAt(
  lesson: { startClock?: string | null; startTime: string },
  date: { year: number; month: number; day: number },
  tz: string = TZ,
): Date | null {
  const minutes = resolveStartMinutes(lesson, date);
  if (minutes === null) return null;
  return zonedToUtc(date.year, date.month, date.day, Math.floor(minutes / 60), minutes % 60, tz);
}
