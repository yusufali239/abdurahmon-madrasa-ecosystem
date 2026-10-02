import { Controller, Get } from '@nestjs/common';
import { computePrayerTimes, minutesToHHmm } from './common/prayer-times';
import { formatDateUz, weekDayName, zonedParts } from './common/time.util';
import { AppConfig } from './config/app-config.service';

/** Публичные мета-данные для Mini App: дата и время намазов в Оше */
@Controller('meta')
export class MetaController {
  constructor(private readonly cfg: AppConfig) {}

  @Get('today')
  today() {
    const now = zonedParts(new Date(), this.cfg.timezone);
    const p = computePrayerTimes(now.year, now.month, now.day);
    const minutesNow = now.hour * 60 + now.minute;
    const list = [
      { key: 'bomdod', name: 'Bomdod', minutes: p.bomdod },
      { key: 'quyosh', name: 'Quyosh', minutes: p.quyosh },
      { key: 'peshin', name: 'Peshin', minutes: p.peshin },
      { key: 'asr', name: 'Asr', minutes: p.asr },
      { key: 'shom', name: 'Shom', minutes: p.shom },
      { key: 'xufton', name: 'Xufton', minutes: p.xufton },
    ];
    const next = list.find((x) => x.minutes > minutesNow) ?? list[0];
    return {
      weekDay: now.weekDay,
      weekDayName: weekDayName(now.weekDay),
      date: formatDateUz(new Date(), this.cfg.timezone),
      city: 'Osh',
      prayers: list.map((x) => ({ ...x, time: minutesToHHmm(x.minutes) })),
      next: next.key,
    };
  }
}
