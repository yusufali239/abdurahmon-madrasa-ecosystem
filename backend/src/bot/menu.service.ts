import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { InlineKeyboard } from 'grammy';
import { resolveStartMinutes } from '../common/lesson-time';
import { computePrayerTimes, minutesToHHmm } from '../common/prayer-times';
import { formatDateUz, weekDayName, zonedParts } from '../common/time.util';
import { AppConfig } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { pageTopicLine } from '../lessons/lesson-format';
import { esc, isTelegramSafeUrl } from './html';
import { MessengerService } from './messenger.service';

const ROLE_UZ: Record<string, string> = { STUDENT: 'Talaba', TEACHER: 'Ustoz', ADMIN: 'Admin' };

/** Главное меню бота (зависит от роли) */
@Injectable()
export class MenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messenger: MessengerService,
    private readonly cfg: AppConfig,
  ) {}

  roleName(role: string) {
    return ROLE_UZ[role] ?? role;
  }

  webAppButton(kb: InlineKeyboard, label = '📱 Madrasa ilovasi', path = '') {
    const url = `${this.cfg.miniAppUrl}${path}`;
    if (isTelegramSafeUrl(url)) kb.webApp(label, url).row();
    return kb;
  }

  async show(user: User, isAdmin = false, notice?: string) {
    const now = zonedParts(new Date(), this.cfg.timezone);
    const prayers = computePrayerTimes(now.year, now.month, now.day);
    const firstName = esc((user.fullName || '').split(' ').slice(-1)[0] || user.fullName || '');

    const lines: string[] = [];
    if (notice) lines.push(notice, '');
    lines.push('🕌 <b>Abdurahmon ibn Avf madrasasi</b>');
    lines.push(`Assalomu alaykum, <b>${firstName}</b>!`);
    lines.push('');
    lines.push(`📅 Bugun: <b>${weekDayName(now.weekDay)}</b>, ${formatDateUz(new Date(), this.cfg.timezone)}`);
    lines.push(`🌅 Bomdod ${minutesToHHmm(prayers.bomdod)} · ☀️ Peshin ${minutesToHHmm(prayers.peshin)} · 🌤 Asr ${minutesToHHmm(prayers.asr)}`);
    lines.push(`🌇 Shom ${minutesToHHmm(prayers.shom)} · 🌙 Xufton ${minutesToHHmm(prayers.xufton)}`);

    const today = await this.todayLessons(user, now.weekDay);
    if (today.length) {
      lines.push('', `📚 <b>Bugungi darslar (${today.length}):</b>`);
      for (const l of today) {
        const start = resolveStartMinutes(l, now);
        const pt = pageTopicLine(l.currentPage, l.topic);
        lines.push(
          `• ${esc(l.subject.name)} — ${esc(l.teacher.user.fullName)}\n   🕰 ${esc(l.startTime)}${start !== null ? ` (~${minutesToHHmm(start)})` : ''}, ${esc(l.endTime)}` +
            (pt ? `\n   📖 ${pt}` : ''),
        );
      }
    } else {
      lines.push('', '📚 Bugun sizda dars yo\'q.');
    }

    const kb = new InlineKeyboard();
    this.webAppButton(kb);
    kb.text('📅 Bugungi darslar', 'menu:today').text('📚 Darslarim', 'menu:lessons').row();
    kb.text('📰 Yangiliklar', 'menu:news').text('👤 Profil', 'menu:profile').row();
    if (user.role === 'TEACHER') {
      kb.text('✅ Davomat', 'menu:attendance').text('🤝 Hayriya', 'menu:fund').row();
    } else {
      kb.text('📊 Baholarim', 'menu:grades').text('🤝 Hayriya', 'menu:fund').row();
    }
    if (isAdmin) {
      kb.text('⏳ Arizalar', 'menu:pending').text('🛠 Admin panel', 'menu:admin').row();
    }
    await this.messenger.send(user.telegramId, lines.join('\n'), { reply_markup: kb });
  }

  /** Уроки на сегодня: для учителя — его уроки, для студента — записанные */
  async todayLessons(user: User, weekDay: number) {
    const include = { subject: true, teacher: { include: { user: true } }, location: true } as const;
    if (user.role === 'TEACHER') {
      return this.prisma.lesson.findMany({
        where: { weekDays: { has: weekDay }, isActive: true, teacher: { userId: user.id } },
        include,
      });
    }
    return this.prisma.lesson.findMany({
      where: { weekDays: { has: weekDay }, isActive: true, enrollments: { some: { studentId: user.id, status: 'ACTIVE' } } },
      include,
    });
  }

  backKeyboard(kb = new InlineKeyboard()) {
    return kb.text('⬅️ Bosh menyu', 'menu:home');
  }
}
