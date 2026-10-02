/**
 * Расчёт времени намазов (алгоритм PrayTimes.org).
 * По умолчанию — город Ош: широта 40.5283, долгота 72.7985, UTC+6.
 * Фаджр 18°, Иша 17° (MWL), Аср — ханафитский (тень x2), Магриб = закат + 3 мин.
 */
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const sin = (d: number) => Math.sin(rad(d));
const cos = (d: number) => Math.cos(rad(d));
const tan = (d: number) => Math.tan(rad(d));
const arcsin = (x: number) => deg(Math.asin(x));
const arccos = (x: number) => deg(Math.acos(Math.max(-1, Math.min(1, x))));
const arctan2 = (y: number, x: number) => deg(Math.atan2(y, x));
const arccot = (x: number) => deg(Math.atan(1 / x));
const fix = (a: number, b: number) => {
  const r = a - b * Math.floor(a / b);
  return r < 0 ? r + b : r;
};

export interface PrayerTimes {
  /** минуты от полуночи по местному времени */
  bomdod: number;
  quyosh: number;
  peshin: number;
  asr: number;
  shom: number;
  xufton: number;
}

export const OSH = { lat: 40.5283, lng: 72.7985, tzHours: 6 };

function julian(year: number, month: number, day: number): number {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
}

function sunPosition(jd: number) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360);
  const q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * sin(g) + 0.02 * sin(2 * g), 360);
  const e = 23.439 - 0.00000036 * D;
  const RA = fix(arctan2(cos(e) * sin(L), cos(L)) / 15, 24);
  let eqt = q / 15 - RA;
  eqt = eqt - 24 * Math.round(eqt / 24);
  const decl = arcsin(sin(e) * sin(L));
  return { decl, eqt };
}

export function computePrayerTimes(
  year: number,
  month: number,
  day: number,
  loc: { lat: number; lng: number; tzHours: number } = OSH,
): PrayerTimes {
  const jDate = julian(year, month, day) - loc.lng / (15 * 24);
  const midDay = (t: number) => fix(12 - sunPosition(jDate + t).eqt, 24);
  const sunAngleTime = (angle: number, t: number, ccw = false) => {
    const { decl } = sunPosition(jDate + t);
    const noon = midDay(t);
    const T = arccos((-sin(angle) - sin(decl) * sin(loc.lat)) / (cos(decl) * cos(loc.lat))) / 15;
    return noon + (ccw ? -T : T);
  };
  const asrTime = (factor: number, t: number) => {
    const { decl } = sunPosition(jDate + t);
    const angle = -arccot(factor + tan(Math.abs(loc.lat - decl)));
    return sunAngleTime(angle, t);
  };
  const adjust = (h: number) => Math.round((h + loc.tzHours - loc.lng / 15) * 60);

  return {
    bomdod: adjust(sunAngleTime(18, 5 / 24, true)),
    quyosh: adjust(sunAngleTime(0.833, 6 / 24, true)),
    peshin: adjust(midDay(12 / 24)) + 1,
    asr: adjust(asrTime(2, 13 / 24)),
    shom: adjust(sunAngleTime(0.833, 18 / 24)) + 3,
    xufton: adjust(sunAngleTime(17, 18 / 24)),
  };
}

export function minutesToHHmm(m: number): string {
  const mm = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`;
}
