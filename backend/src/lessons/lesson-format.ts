import { esc } from '../bot/html';
import { resolveStartMinutes } from '../common/lesson-time';
import { minutesToHHmm } from '../common/prayer-times';
import { formatHHmm, weekDaysText, zonedParts } from '../common/time.util';

export interface LessonLike {
  weekDays: number[];
  startTime: string;
  endTime: string;
  startClock?: string | null;
  bookTitle: string;
  bookTotalPages: number;
  currentPage: number | null;
  topic: string | null;
  subject: { name: string };
  teacher: { user: { fullName: string | null } };
  location?: { title: string; address: string } | null;
}

/** «56-betdan · Halol va harom» — что будет на уроке (если известно) */
export function pageTopicLine(page: number | null | undefined, topic: string | null | undefined): string {
  const parts: string[] = [];
  if (page) parts.push(`${page}-betdan`);
  if (topic) parts.push(esc(topic));
  return parts.join(' · ');
}

/** Прогресс-бар книги: ▓▓▓░░░░░░░ 27% */
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

/** Карточка урока для бота (коротко) */
export function lessonCard(l: LessonLike, opts: { startsAt?: Date | null; page?: number | null; topic?: string | null } = {}) {
  const page = opts.page !== undefined ? opts.page : l.currentPage;
  const topic = opts.topic !== undefined ? opts.topic : l.topic;
  const lines = [
    `📘 <b>${esc(l.subject.name)}</b> — ${esc(l.teacher.user.fullName)}`,
    `🗓 ${weekDaysText(l.weekDays)} · ${timeLine(l, opts.startsAt)}`,
  ];
  const pt = pageTopicLine(page, topic);
  lines.push(`📖 «${esc(l.bookTitle)}»${pt ? `: <b>${pt}</b>` : ''}`);
  if (l.location) lines.push(`📍 ${esc(l.location.title)}, ${esc(l.location.address)}`);
  return lines.join('\n');
}
