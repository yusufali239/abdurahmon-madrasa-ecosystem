import { esc } from '../bot/html';
import { resolveStartMinutes } from '../common/lesson-time';
import { minutesToHHmm } from '../common/prayer-times';
import { formatHHmm, weekDayName, zonedParts } from '../common/time.util';

export interface LessonLike {
  weekDay: number;
  startTime: string;
  endTime: string;
  startClock?: string | null;
  bookTitle: string;
  bookTotalPages: number;
  currentPageFrom: number;
  currentPageTo: number;
  topic: string;
  nextTopic?: string | null;
  subject: { name: string };
  teacher: { user: { fullName: string | null } };
  location?: { title: string; address: string } | null;
}

/** Прогресс-бар книги: ▓▓▓░░░░░░░ 36% */
export function progressBar(done: number, total: number, width = 10): string {
  const pct = Math.max(0, Math.min(1, total ? done / total : 0));
  const filled = Math.round(pct * width);
  return `${'▓'.repeat(filled)}${'░'.repeat(width - filled)} ${Math.round(pct * 100)}%`;
}

export function timeLine(l: LessonLike, startsAt?: Date | null): string {
  let approx = '';
  if (startsAt) approx = ` (~${formatHHmm(startsAt)})`;
  else {
    const m = resolveStartMinutes(l, zonedParts());
    if (m !== null && !/\d{1,2}[:.]\d{2}/.test(l.startTime)) approx = ` (~${minutesToHHmm(m)})`;
  }
  return `🕰 ${esc(l.startTime)}${approx}, ${esc(l.endTime)}`;
}

/** Полная карточка урока для бота */
export function lessonCard(l: LessonLike, opts: { startsAt?: Date | null; pageFrom?: number; pageTo?: number; topic?: string } = {}) {
  const from = opts.pageFrom ?? l.currentPageFrom;
  const to = opts.pageTo ?? l.currentPageTo;
  const lines = [
    `📘 <b>${esc(l.subject.name)}</b> — ${esc(l.teacher.user.fullName)}`,
    `🗓 ${weekDayName(l.weekDay)} · ${timeLine(l, opts.startsAt)}`,
    `📖 «${esc(l.bookTitle)}»: <b>${from}–${to}-bet</b> / ${l.bookTotalPages}`,
    `📝 Mavzu: <b>${esc(opts.topic ?? l.topic)}</b>`,
    `${progressBar(to, l.bookTotalPages)}`,
  ];
  if (l.location) lines.push(`📍 ${esc(l.location.title)}, ${esc(l.location.address)}`);
  return lines.join('\n');
}
