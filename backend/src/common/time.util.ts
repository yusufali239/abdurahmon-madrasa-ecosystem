/**
 * Утилиты времени. Вся бизнес-логика работает в часовом поясе Asia/Bishkek.
 */
export const TZ = 'Asia/Bishkek';

/** 1 = Dushanba ... 7 = Yakshanba */
export const WEEKDAYS_UZ = ['', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
export const MONTHS_UZ = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
];

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 1..7 (Пн..Вс) */
  weekDay: number;
}

const WD: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function zonedParts(date: Date = new Date(), tz: string = TZ): ZonedParts {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(date)) p[part.type] = part.value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
    weekDay: WD[p.weekday] ?? 1,
  };
}

/** Смещение пояса относительно UTC в минутах (Бишкек = +360) */
export function tzOffsetMinutes(date: Date, tz: string = TZ): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Локальное время пояса -> момент UTC */
export function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number, tz: string = TZ): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const off = tzOffsetMinutes(new Date(guess), tz);
  return new Date(guess - off * 60_000);
}

/** Дата (без времени) для полей @db.Date — полночь UTC той же календарной даты */
export function dateOnly(p: Pick<ZonedParts, 'year' | 'month' | 'day'>): Date {
  return new Date(Date.UTC(p.year, p.month - 1, p.day));
}

export function todayInTz(tz: string = TZ): Date {
  return dateOnly(zonedParts(new Date(), tz));
}

/** Текущий расчётный период "YYYY-MM" */
export function currentPeriod(tz: string = TZ, date: Date = new Date()): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}`;
}

export function formatHHmm(date: Date, tz: string = TZ): string {
  const p = zonedParts(date, tz);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/** "2-oktabr" */
export function formatDateUz(date: Date, tz: string = TZ): string {
  const p = zonedParts(date, tz);
  return `${p.day}-${MONTHS_UZ[p.month - 1]}`;
}

export function weekDayName(weekDay: number): string {
  return WEEKDAYS_UZ[weekDay] ?? '';
}

/** 3270 -> "3 270" */
export function formatSom(amount: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(amount).replace(/ /g, ' ')} som`;
}
