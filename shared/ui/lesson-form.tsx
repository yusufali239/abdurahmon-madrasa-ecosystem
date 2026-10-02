import { HandHeart, Wallet } from 'lucide-react';
import { cn, WEEKDAYS_SHORT } from '../lib/utils';
import { Field, Input, Select } from './input';
import { Switch } from './switch';

export interface LessonFormValue {
  subjectId: number | '';
  locationId: number | '' | null;
  isContinuous: boolean;
  weekDay: number;
  startTime: string;
  startClock: string;
  endTime: string;
  bookTitle: string;
  bookTotalPages: number | '';
  currentPageFrom: number | '';
  currentPageTo: number | '';
  topic: string;
  nextTopic: string;
  priceTier: number;
  customPrice: number | '' | null;
  paymentType: 'MBANK_SELF' | 'HAYRIYA';
  isActive: boolean;
}

export const EMPTY_LESSON: LessonFormValue = {
  subjectId: '',
  locationId: '',
  isContinuous: true,
  weekDay: 4,
  startTime: 'Shomdan keyin',
  startClock: '',
  endTime: '22:00 gacha',
  bookTitle: '',
  bookTotalPages: 200,
  currentPageFrom: 1,
  currentPageTo: 10,
  topic: '',
  nextTopic: '',
  priceTier: 100,
  customPrice: null,
  paymentType: 'MBANK_SELF',
  isActive: true,
};

const START_PRESETS = ['Bomdoddan keyin', 'Peshindan keyin', 'Asrdan keyin', 'Shomdan keyin', 'Xuftondan keyin'];
const TIERS = [0, 50, 100, 200];

/** Приводит значение формы к телу запроса API */
export function lessonPayload(v: LessonFormValue) {
  return {
    subjectId: Number(v.subjectId),
    locationId: v.locationId ? Number(v.locationId) : null,
    isContinuous: v.isContinuous,
    weekDay: v.weekDay,
    startTime: v.startTime.trim(),
    startClock: v.startClock || null,
    endTime: v.endTime.trim(),
    bookTitle: v.bookTitle.trim(),
    bookTotalPages: Number(v.bookTotalPages),
    currentPageFrom: Number(v.currentPageFrom),
    currentPageTo: Number(v.currentPageTo),
    topic: v.topic.trim(),
    nextTopic: v.nextTopic.trim() || null,
    priceTier: v.priceTier,
    customPrice: v.customPrice ? Number(v.customPrice) : null,
    paymentType: v.paymentType,
    isActive: v.isActive,
  };
}

export function lessonToForm(l: any): LessonFormValue {
  return {
    subjectId: l.subjectId,
    locationId: l.locationId ?? '',
    isContinuous: l.isContinuous,
    weekDay: l.weekDay,
    startTime: l.startTime,
    startClock: l.startClock ?? '',
    endTime: l.endTime,
    bookTitle: l.bookTitle,
    bookTotalPages: l.bookTotalPages,
    currentPageFrom: l.currentPageFrom,
    currentPageTo: l.currentPageTo,
    topic: l.topic,
    nextTopic: l.nextTopic ?? '',
    priceTier: l.priceTier,
    customPrice: l.customPrice ?? null,
    paymentType: l.paymentType,
    isActive: l.isActive,
  };
}

/** Форма урока (Mini App учителя и админ-панель) */
export function LessonForm({
  value,
  onChange,
  subjects,
  locations,
}: {
  value: LessonFormValue;
  onChange: (v: LessonFormValue) => void;
  subjects: Array<{ id: number; name: string }>;
  locations: Array<{ id: number; title: string }>;
}) {
  const set = <K extends keyof LessonFormValue>(k: K, v: LessonFormValue[K]) => onChange({ ...value, [k]: v });
  const num = (s: string) => (s === '' ? '' : Number(s));
  const personal = value.customPrice !== null && value.customPrice !== '' ? true : false;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fan">
          <Select value={value.subjectId} onChange={(e) => set('subjectId', num(e.target.value) as number)}>
            <option value="">Tanlang…</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Manzil">
          <Select value={value.locationId ?? ''} onChange={(e) => set('locationId', num(e.target.value) as number)}>
            <option value="">— Ko'rsatilmagan</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Hafta kuni">
        <div className="grid grid-cols-7 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <button
              type="button"
              key={d}
              onClick={() => set('weekDay', d)}
              className={cn('rounded-xl border py-2 text-xs font-bold', value.weekDay === d ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground')}
            >
              {WEEKDAYS_SHORT[d]}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Boshlanish vaqti" hint="Namozga bog'langan vaqt Osh namoz jadvalidan avtomatik hisoblanadi">
        <Input value={value.startTime} onChange={(e) => set('startTime', e.target.value)} placeholder="Shomdan keyin yoki 18:30" />
        <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
          {START_PRESETS.map((p) => (
            <button
              type="button"
              key={p}
              onClick={() => set('startTime', p)}
              className={cn('shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold', value.startTime === p ? 'border-gold bg-gold-soft' : 'text-muted-foreground')}
            >
              {p}
            </button>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Aniq vaqt (ixtiyoriy)">
          <Input type="time" value={value.startClock} onChange={(e) => set('startClock', e.target.value)} />
        </Field>
        <Field label="Tugash">
          <Input value={value.endTime} onChange={(e) => set('endTime', e.target.value)} placeholder="22:00 gacha" />
        </Field>
      </div>

      <div className="rounded-2xl border bg-muted/40 p-3">
        <Switch checked={value.isContinuous} onChange={(v) => set('isContinuous', v)} label="Davomiy dars (har hafta, 08:00 da tasdiq so'raladi)" />
      </div>

      <Field label="Kitob">
        <Input value={value.bookTitle} onChange={(e) => set('bookTitle', e.target.value)} placeholder="Muxtasar al-Quduriy" />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Jami bet">
          <Input type="number" inputMode="numeric" value={value.bookTotalPages} onChange={(e) => set('bookTotalPages', num(e.target.value))} />
        </Field>
        <Field label="Betdan">
          <Input type="number" inputMode="numeric" value={value.currentPageFrom} onChange={(e) => set('currentPageFrom', num(e.target.value))} />
        </Field>
        <Field label="Betgacha">
          <Input type="number" inputMode="numeric" value={value.currentPageTo} onChange={(e) => set('currentPageTo', num(e.target.value))} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Mavzu">
          <Input value={value.topic} onChange={(e) => set('topic', e.target.value)} placeholder="Halol va harom" />
        </Field>
        <Field label="Keyingi mavzu">
          <Input value={value.nextTopic} onChange={(e) => set('nextTopic', e.target.value)} placeholder="Savdo odoblari" />
        </Field>
      </div>

      <Field label="Oylik narx (som)">
        <div className="grid grid-cols-5 gap-1.5">
          {TIERS.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => onChange({ ...value, priceTier: t, customPrice: null })}
              className={cn(
                'rounded-xl border py-2.5 text-sm font-bold',
                !personal && value.priceTier === t ? 'border-primary bg-primary text-primary-foreground shadow-soft' : 'bg-card text-muted-foreground',
              )}
            >
              {t === 0 ? 'Bepul' : t}
            </button>
          ))}
          <button
            type="button"
            onClick={() => set('customPrice', value.customPrice || 150)}
            className={cn('rounded-xl border py-2.5 text-xs font-bold', personal ? 'border-gold bg-gold text-gold-foreground shadow-gold' : 'bg-card text-muted-foreground')}
          >
            Shaxsiy
          </button>
        </div>
        {personal && (
          <Input className="mt-2" type="number" inputMode="numeric" value={value.customPrice ?? ''} onChange={(e) => set('customPrice', num(e.target.value))} placeholder="Shaxsiy narx" />
        )}
      </Field>

      <Field label="To'lov turi">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { v: 'MBANK_SELF', icon: Wallet, title: 'MBank (o\'zimga)', text: 'Talaba ustoz MBank raqamiga to\'laydi' },
              { v: 'HAYRIYA', icon: HandHeart, title: 'Hayriya', text: 'Pul madrasa jamg\'armasiga tushadi' },
            ] as const
          ).map((o) => (
            <button
              type="button"
              key={o.v}
              onClick={() => set('paymentType', o.v)}
              className={cn(
                'rounded-2xl border p-3 text-left transition',
                value.paymentType === o.v ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'bg-card',
              )}
            >
              <o.icon className={cn('mb-1.5 size-5', value.paymentType === o.v ? 'text-primary' : 'text-muted-foreground')} />
              <p className="text-sm font-bold">{o.title}</p>
              <p className="text-[11px] leading-snug text-muted-foreground">{o.text}</p>
            </button>
          ))}
        </div>
      </Field>

      <Switch checked={value.isActive} onChange={(v) => set('isActive', v)} label="Dars faol" />
    </div>
  );
}
