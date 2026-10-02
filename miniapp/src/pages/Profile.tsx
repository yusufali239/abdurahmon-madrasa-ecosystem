import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, GraduationCap, MapPin, Phone, Plus, Trash2, Wallet, X } from 'lucide-react';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Dialog, DialogContent } from '@shared/ui/dialog';
import { Field, Input, Select, Textarea } from '@shared/ui/input';
import { cn, dateUz, MAP_PROVIDERS, PAYMENT_STATUS, som } from '@shared/lib/utils';
import { api, absUrl, setDevId } from '@/lib/api';
import { useMe } from '@/lib/me';
import { haptic, inTelegram, openLink } from '@/lib/telegram';
import type { Location, Payment, Subject } from '@/lib/types';
import { ErrorBox, PageHeader, SectionTitle } from '@/components/common';

interface Stats {
  attendance: { total: number; percent: number | null; PRESENT?: number; ABSENT?: number; LATE?: number };
  averageScore: number | null;
  grades: Array<{ id: number; score: number; comment: string | null; createdAt: string; lesson: { subject: Subject } }>;
}

function StatusBadge({ status }: { status: Payment['status'] }) {
  const s = PAYMENT_STATUS[status];
  return <Badge variant={s.tone === 'green' ? 'default' : s.tone === 'red' ? 'red' : 'gold'}>{s.label}</Badge>;
}

function StudentSection() {
  const stats = useQuery({ queryKey: ['stats'], queryFn: () => api<Stats>('/me/stats') });
  const payments = useQuery({ queryKey: ['payments', 'mine'], queryFn: () => api<Payment[]>('/payments/mine') });
  const s = stats.data;
  return (
    <>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          { label: 'Davomat', value: s?.attendance.percent != null ? `${s.attendance.percent}%` : '—' },
          { label: "O'rtacha baho", value: s?.averageScore ?? '—' },
          { label: 'Darslar', value: s?.attendance.total ?? 0 },
        ].map((x) => (
          <div key={x.label} className="rounded-2xl border bg-card p-3 text-center shadow-soft">
            <p className="text-xl font-extrabold text-primary">{x.value}</p>
            <p className="text-[11px] font-semibold text-muted-foreground">{x.label}</p>
          </div>
        ))}
      </div>
      <Button asChild variant="outline" className="mt-3 w-full">
        <Link to="/lessons?mine=1">
          Mening darslarim <ChevronRight />
        </Link>
      </Button>

      <SectionTitle>Baholar</SectionTitle>
      <div className="rounded-2xl border bg-card shadow-soft">
        {!s?.grades.length && <p className="p-4 text-sm text-muted-foreground">Hali baholar yo'q.</p>}
        {s?.grades.slice(0, 10).map((g) => (
          <div key={g.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-0">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/10 font-extrabold text-primary">{g.score}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{g.lesson.subject.name}</p>
              {g.comment && <p className="truncate text-xs text-muted-foreground">{g.comment}</p>}
            </div>
            <span className="text-xs text-muted-foreground">{dateUz(g.createdAt)}</span>
          </div>
        ))}
      </div>

      <SectionTitle>To'lovlar tarixi</SectionTitle>
      <div className="space-y-2">
        {!payments.data?.length && <p className="text-sm text-muted-foreground">To'lovlar yo'q.</p>}
        {payments.data?.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3 shadow-soft">
            <div className="min-w-0">
              <p className="text-sm font-bold">
                {som(p.amount)} · {p.lesson ? p.lesson.subject.name : 'Hayriya'}
              </p>
              <p className="text-xs text-muted-foreground">
                {p.paymentType === 'HAYRIYA' ? 'Hayriya jamg\'armasi' : `MBank → ${p.teacher?.user.fullName}`} · {dateUz(p.createdAt)}
              </p>
            </div>
            <StatusBadge status={p.status} />
          </div>
        ))}
      </div>
    </>
  );
}

interface TeacherMe {
  id: number;
  telegramPhone: string;
  mbankNumber: string;
  bio: string | null;
  subjects: Subject[];
  locations: Location[];
  donationFund: { personalTotal: number } | null;
}

function LocationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: '', address: '', map_url: '', provider: 'TWOGIS', lat: '', lng: '' });
  const save = useMutation({
    mutationFn: () =>
      api('/teachers/me/locations', {
        body: { ...form, lat: form.lat ? Number(form.lat) : undefined, lng: form.lng ? Number(form.lng) : undefined },
      }),
    onSuccess: () => {
      haptic('success');
      qc.invalidateQueries({ queryKey: ['teacher-me'] });
      onOpenChange(false);
      setForm({ title: '', address: '', map_url: '', provider: 'TWOGIS', lat: '', lng: '' });
    },
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="bottom" title="Yangi manzil" description="Dars o'tiladigan joy: 2GIS, Yandex yoki Google xarita havolasi">
        <div className="space-y-3">
          <Field label="Nomi">
            <Input value={form.title} onChange={set('title')} placeholder="Abdurahmon ibn Avf masjidi" />
          </Field>
          <Field label="Manzil">
            <Input value={form.address} onChange={set('address')} placeholder="Osh sh., ..." />
          </Field>
          <Field label="Xarita havolasi" hint="Provayder havoladan avtomatik aniqlanadi">
            <Input value={form.map_url} onChange={set('map_url')} placeholder="https://2gis.kg/osh/..." />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Xarita">
              <Select value={form.provider} onChange={set('provider')}>
                <option value="TWOGIS">2GIS</option>
                <option value="YANDEX">Yandex</option>
                <option value="GOOGLE">Google</option>
              </Select>
            </Field>
            <Field label="Lat">
              <Input value={form.lat} onChange={set('lat')} inputMode="decimal" placeholder="40.52" />
            </Field>
            <Field label="Lng">
              <Input value={form.lng} onChange={set('lng')} inputMode="decimal" placeholder="72.79" />
            </Field>
          </div>
          {save.error && <ErrorBox error={save.error} />}
          <Button className="w-full" size="lg" loading={save.isPending} onClick={() => save.mutate()}>
            Saqlash
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TeacherSection() {
  const qc = useQueryClient();
  const t = useQuery({ queryKey: ['teacher-me'], queryFn: () => api<TeacherMe>('/teachers/me') });
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: () => api<Subject[]>('/subjects') });
  const payments = useQuery({ queryKey: ['payments', 'teacher'], queryFn: () => api<Payment[]>('/payments/teacher') });
  const [form, setForm] = useState({ telegramPhone: '', mbankNumber: '', bio: '', subjectIds: [] as number[] });
  const [locOpen, setLocOpen] = useState(false);
  useEffect(() => {
    if (t.data)
      setForm({ telegramPhone: t.data.telegramPhone, mbankNumber: t.data.mbankNumber, bio: t.data.bio || '', subjectIds: t.data.subjects.map((s) => s.id) });
  }, [t.data]);
  const save = useMutation({
    mutationFn: () => api('/teachers/me', { method: 'PATCH', body: form }),
    onSuccess: () => {
      haptic('success');
      qc.invalidateQueries({ queryKey: ['teacher-me'] });
    },
  });
  const removeLoc = useMutation({
    mutationFn: (id: number) => api(`/teachers/me/locations/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teacher-me'] }),
  });
  const decide = useMutation({
    mutationFn: ({ id, ok }: { id: number; ok: boolean }) => api(`/payments/${id}/${ok ? 'confirm' : 'reject'}`, { method: 'POST' }),
    onSuccess: () => {
      haptic('success');
      qc.invalidateQueries({ queryKey: ['payments', 'teacher'] });
    },
  });
  const toggleSubject = (id: number) =>
    setForm((f) => ({ ...f, subjectIds: f.subjectIds.includes(id) ? f.subjectIds.filter((x) => x !== id) : [...f.subjectIds, id] }));
  const pending = payments.data?.filter((p) => p.status === 'PENDING' && p.paymentType === 'MBANK_SELF') ?? [];

  return (
    <>
      <Button asChild className="mt-4 w-full" size="lg">
        <Link to="/teacher">
          <GraduationCap /> Ustoz paneli: darslar, davomat, baholar
        </Link>
      </Button>

      {pending.length > 0 && (
        <>
          <SectionTitle>Tasdiqlanmagan to'lovlar ({pending.length})</SectionTitle>
          <div className="space-y-2">
            {pending.map((p) => (
              <div key={p.id} className="rounded-2xl border border-gold/40 bg-card p-3.5 shadow-soft">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold">{p.student?.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {som(p.amount)} · {p.lesson?.subject.name} · {p.period}
                    </p>
                  </div>
                  {p.receipt_url && (
                    <button onClick={() => openLink(absUrl(p.receipt_url))} className="text-xs font-bold text-primary underline">
                      Chek
                    </button>
                  )}
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <Button size="sm" onClick={() => decide.mutate({ id: p.id, ok: true })}>
                    <Check /> Tasdiqlash
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: p.id, ok: false })}>
                    <X /> Rad etish
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionTitle>Ustoz ma'lumotlari</SectionTitle>
      <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-soft">
        <Field label="Telegram raqami" hint="Talabalar siz bilan bog'lanadi">
          <div className="relative">
            <Phone className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
            <Input className="pl-9" value={form.telegramPhone} onChange={(e) => setForm({ ...form, telegramPhone: e.target.value })} inputMode="tel" />
          </div>
        </Field>
        <Field label="MBank raqami" hint="MBANK_SELF darslarda to'lov shu raqamga tushadi">
          <div className="relative">
            <Wallet className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
            <Input className="pl-9" value={form.mbankNumber} onChange={(e) => setForm({ ...form, mbankNumber: e.target.value })} inputMode="tel" />
          </div>
        </Field>
        <Field label="Fanlar">
          <div className="flex flex-wrap gap-2">
            {subjects.data?.map((s) => (
              <button
                key={s.id}
                onClick={() => toggleSubject(s.id)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-bold',
                  form.subjectIds.includes(s.id) ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground',
                )}
              >
                {s.name}
              </button>
            ))}
          </div>
        </Field>
        <Field label="O'zingiz haqingizda">
          <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
        </Field>
        {save.error && <ErrorBox error={save.error} />}
        <Button className="w-full" loading={save.isPending} onClick={() => save.mutate()}>
          {save.isSuccess ? '✓ Saqlandi' : 'Saqlash'}
        </Button>
      </div>

      <SectionTitle action={<Button size="sm" variant="secondary" onClick={() => setLocOpen(true)}><Plus /> Qo'shish</Button>}>Manzillar</SectionTitle>
      <div className="space-y-2">
        {t.data?.locations.map((l) => (
          <div key={l.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-soft">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <MapPin className="size-5" />
            </span>
            <button className="min-w-0 flex-1 text-left" onClick={() => openLink(l.map_url)}>
              <p className="truncate text-sm font-bold">{l.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {MAP_PROVIDERS[l.provider]} · {l.address}
              </p>
            </button>
            <button onClick={() => removeLoc.mutate(l.id)} className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="O'chirish">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
      <LocationDialog open={locOpen} onOpenChange={setLocOpen} />
    </>
  );
}

export default function ProfilePage() {
  const me = useMe();
  const initials = (me.fullName || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('');
  return (
    <div>
      <PageHeader title="Profil" />
      <div className="flex items-center gap-4 rounded-3xl border bg-card p-4 shadow-soft">
        <span className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-[#0B3F31] text-xl font-extrabold text-primary-foreground">
          {initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-extrabold">{me.fullName}</p>
          <p className="text-sm text-muted-foreground">{me.phone}</p>
          <div className="mt-1 flex gap-1.5">
            <Badge variant="solid">{me.role === 'TEACHER' ? 'Ustoz' : me.role === 'ADMIN' ? 'Admin' : 'Talaba'}</Badge>
            {me.passportId && <Badge variant="outline">ID •••{me.passportId.slice(-3)}</Badge>}
          </div>
        </div>
      </div>
      {me.role === 'TEACHER' ? <TeacherSection /> : <StudentSection />}
      {!inTelegram() && (
        <Button
          variant="ghost"
          className="mt-6 w-full text-muted-foreground"
          onClick={() => {
            setDevId(null);
            location.href = '/';
          }}
        >
          Chiqish (dev)
        </Button>
      )}
    </div>
  );
}
