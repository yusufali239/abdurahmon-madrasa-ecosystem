import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 16370 -> "16 370 som" */
export function som(n: number | null | undefined) {
  return `${new Intl.NumberFormat('ru-RU').format(n ?? 0).replace(/ /g, ' ')} som`;
}

export const WEEKDAYS = ['', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
export const WEEKDAYS_SHORT = ['', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

/** "2-oktabr, 2026" */
export function dateUz(d: string | Date, withYear = false) {
  const date = new Date(d);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bishkek', year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(date)
    .reduce<Record<string, string>>((a, p) => ((a[p.type] = p.value), a), {});
  return `${Number(parts.day)}-${MONTHS[Number(parts.month) - 1]}${withYear ? `, ${parts.year}` : ''}`;
}

export function timeUz(d: string | Date) {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Bishkek', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
}

export const NEWS_TYPES: Record<string, { label: string; emoji: string }> = {
  TADBIR: { label: 'Tadbir', emoji: '🎉' },
  SPORT_FUTBOL: { label: 'Sport / Futbol', emoji: '⚽️' },
  ELON: { label: "E'lon", emoji: '📢' },
};

export const PAYMENT_STATUS: Record<string, { label: string; tone: 'gold' | 'green' | 'red' }> = {
  PENDING: { label: 'Tekshirilmoqda', tone: 'gold' },
  CONFIRMED: { label: 'Tasdiqlandi', tone: 'green' },
  REJECTED: { label: 'Rad etildi', tone: 'red' },
};

export const MAP_PROVIDERS: Record<string, string> = { TWOGIS: '2GIS', YANDEX: 'Yandex', GOOGLE: 'Google' };
