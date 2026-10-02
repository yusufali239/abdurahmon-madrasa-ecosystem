import { BookOpen, BookOpenCheck, HandHeart, Wallet } from 'lucide-react';
import { cn, WEEKDAYS_SHORT } from '../lib/utils';
import { Field, Input, Select } from './input';
import { Switch } from './switch';

export interface LessonFormValue {
  subjectId: number | '';
  locationId: number | '' | null;
  weekDays: number[];
  startTime: string;
  startClock: string;
  endTime: string;
  bookTitle: string;
  bookTotalPages: number | '';
  /** true — новая книга (с 1-й стр.), false — продолжающаяся (страницу спросим при старте урока) */
  isNewBook: boolean;
  priceTier: number;
  customPrice: number | '' | null;
  paymentType: 'MBANK_SELF' | 'HAYRIYA';
  isActive: boolean;
}

export const EMPTY_LESSON: LessonFormValue = {
  subjectId: '',
  locationId: '',
  weekDays: [],
  startTime: 'Shomdan keyin',
  startClock: '',
  endTime: '22:00 gacha',
  bookTitle: '',
  bookTotalPages: '',
  isNewBook: true,
  priceTier: 100,
  customPrice: null,
  paymentType: 'MBANK_SELF',
  isActive: true,
};

const START_PRESETS = ['Bomdoddan keyin', 'Peshindan keyin', 'Asrdan keyin', 'Shomdan keyin', 'Xuftondan keyin'];
const TIERS = [0, 50, 100, 200];

/** Значение формы -> тело запроса API */
export function lessonPayload(v: LessonFormValue) {
  return {
    subjectId: Number(v.subjectId),
    locationId: v.locationId ? Number(v.locationId) : null,
    weekDays: v.weekDays,
    startTime: v.startTime.trim(),
    startClock: v.startClock || null,
    endTime: v.endTime.trim(),
    bookTitle: v.bookTitle.trim(),
    bookTotalPages: Number(v.bookTotalPages),
    isNewBook: v.isNewBook,
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
    weekDays: l.weekDays ?? [],
    startTime: l.startTime,
    startClock: l.startClock ?? '',
    endTime: l.endTime,
    bookTitle: l.bookTitle,
    bookTotalPages: l.bookTotalPages,
    isNewBook: l.isNewBook,
    priceTier: l.priceTier,
    customPrice: l.customPrice ?? null,
    paymentType: l.paymentType,
    isActive: l.isActive,
  };
}

/** Простая проверка перед отправкой: что ещё не заполнено */
export function lessonFormMissing(v: LessonFormValue): string | null {
  if (!v.subjectId) return 'Fanni tanlang';
  if (!v.weekDays.length) return 'Kamida bitta kunni tanlang';
  if (!v.bookTitle.trim()) return 'Kitob nomini yozing';
  if (!v.bookTotalPages || Number(v.bookTotalPages) < 1) return 'Kitobdagi betlar sonini yozing';
  return null;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Choice({
  active,
  onClick,
  icon: Icon,
  title,
  text,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Wallet;
  title: string;
  text: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('rounded-2xl border p-4 text-left transition', active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-card hover:bg-muted/50')}
    >
      <Icon className={cn('mb-2 size-5', active ? 'text-primary' : 'text-muted-foreground')} />
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{text}</p>
    </button>
  );
}

/** Форма урока (Mini App учителя и админ-панель) */
export function LessonForm({
  value,
  onChange,
  subjects,
  locations,
  isEdit = false,
}: {
  value: LessonFormValue;
  onChange: (v: LessonFormValue) => void;
  subjects: Array<{ id: number; name: string }>;
  locations: Array<{ id: number; title: string }>;
  isEdit?: boolean;
}) {
  const set = <K extends keyof LessonFormValue>(k: K, v: LessonFormValue[K]) => onChange({ ...value, [k]: v });
  const num = (s: string) => (s === '' ? '' : Number(s));
  const personal = value.customPrice !== null && value.customPrice !== '';
  const toggleDay = (d: number) =>
    set('weekDays', value.weekDays.includes(d) ? value.weekDays.filter((x) => x !== d) : [...value.weekDays, d].sort());

  return (
    <div className="space-y-8">
      <Section title="Dars">
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
        <Field label="Kunlar">
          <div className="grid grid-cols-7 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => toggleDay(d)}
                aria-pressed={value.weekDays.includes(d)}
                className={cn(
                  'h-11 rounded-xl border text-sm font-semibold transition',
                  value.weekDays.includes(d) ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground',
                )}
              >
                {WEEKDAYS_SHORT[d]}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Boshlanishi">
          <Input value={value.startTime} onChange={(e) => set('startTime', e.target.value)} placeholder="Shomdan keyin yoki 18:30" />
          <div className="no-scrollbar -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1">
            {START_PRESETS.map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => set('startTime', p)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1 text-xs',
                  value.startTime === p ? 'border-primary text-primary' : 'text-muted-foreground',
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tugashi">
            <Input value={value.endTime} onChange={(e) => set('endTime', e.target.value)} placeholder="22:00 gacha" />
          </Field>
          <Field label="Aniq vaqt">
            <Input type="time" value={value.startClock} onChange={(e) => set('startClock', e.target.value)} />
          </Field>
        </div>
        {locations.length > 0 && (
          <Field label="Joy">
            <Select value={value.locationId ?? ''} onChange={(e) => set('locationId', num(e.target.value) as number)}>
              <option value="">Ko'rsatilmagan</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </Section>

      <Section title="Kitob">
        <div className="grid grid-cols-2 gap-3">
          <Choice
            active={value.isNewBook}
            onClick={() => set('isNewBook', true)}
            icon={BookOpen}
            title="Yangi kitob"
            text="1-betdan"
          />
          <Choice
            active={!value.isNewBook}
            onClick={() => set('isNewBook', false)}
            icon={BookOpenCheck}
            title="Davom etayotgan"
            text="Bet darsda so'raladi"
          />
        </div>
        <Field label="Kitob nomi">
          <Input value={value.bookTitle} onChange={(e) => set('bookTitle', e.target.value)} placeholder="Muxtasar al-Quduriy" />
        </Field>
        <Field label="Jami betlar">
          <Input type="number" inputMode="numeric" value={value.bookTotalPages} onChange={(e) => set('bookTotalPages', num(e.target.value))} placeholder="200" />
        </Field>
      </Section>

      <Section title="Narx (bir dars uchun)">
        <div className="grid grid-cols-5 gap-1.5">
          {TIERS.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => onChange({ ...value, priceTier: t, customPrice: null })}
              className={cn(
                'h-11 rounded-xl border text-sm font-semibold transition',
                !personal && value.priceTier === t ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground',
              )}
            >
              {t === 0 ? 'Bepul' : t}
            </button>
          ))}
          <button
            type="button"
            onClick={() => set('customPrice', value.customPrice || 150)}
            className={cn('h-11 rounded-xl border text-xs font-semibold', personal ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground')}
          >
            Boshqa
          </button>
        </div>
        {personal && (
          <Input type="number" inputMode="numeric" value={value.customPrice ?? ''} onChange={(e) => set('customPrice', num(e.target.value))} placeholder="Summa, som" />
        )}
        <div className="grid grid-cols-2 gap-3">
          <Choice
            active={value.paymentType === 'MBANK_SELF'}
            onClick={() => set('paymentType', 'MBANK_SELF')}
            icon={Wallet}
            title="O'zimga"
            text="O'zim tekshiraman"
          />
          <Choice
            active={value.paymentType === 'HAYRIYA'}
            onClick={() => set('paymentType', 'HAYRIYA')}
            icon={HandHeart}
            title="Hayriyaga"
            text="Admin tekshiradi"
          />
        </div>
      </Section>

      {isEdit && <Switch checked={value.isActive} onChange={(v) => set('isActive', v)} label="Dars faol" />}
    </div>
  );
}
