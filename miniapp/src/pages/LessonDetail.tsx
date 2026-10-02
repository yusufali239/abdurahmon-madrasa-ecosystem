import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import {
  BookOpenText,
  CalendarDays,
  Clock3,
  FileText,
  Headphones,
  Infinity as InfinityIcon,
  Lock,
  MapPin,
  Navigation,
  Settings2,
  Star,
  Video,
} from 'lucide-react';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs';
import { cn, dateUz, MAP_PROVIDERS, PAYMENT_STATUS, som, WEEKDAYS } from '@shared/lib/utils';
import { api } from '@/lib/api';
import { useMe } from '@/lib/me';
import { haptic, openLink } from '@/lib/telegram';
import type { ContentItem, LessonDetail } from '@/lib/types';
import { AudioPlayer } from '@/components/AudioPlayer';
import { BookProgress, EmptyState, ErrorBox, ListSkeleton, SectionTitle, SubjectIcon } from '@/components/common';
import { PaymentTypeBadge, PriceBadge } from '@/components/LessonCard';
import { PaymentSheet } from '@/components/PaymentSheet';
import { PdfGrid } from '@/components/PdfGrid';
import { VideoPlayer } from '@/components/VideoPlayer';

const ATT: Record<string, { label: string; cls: string }> = {
  PRESENT: { label: 'Keldi', cls: 'bg-primary/10 text-primary' },
  LATE: { label: 'Kechikdi', cls: 'bg-gold-soft text-gold-foreground' },
  ABSENT: { label: 'Kelmadi', cls: 'bg-destructive/10 text-destructive' },
  EXCUSED: { label: 'Sababli', cls: 'bg-muted text-muted-foreground' },
};

function LockedRow({ c, onPay }: { c: ContentItem; onPay: () => void }) {
  return (
    <button onClick={onPay} className="flex w-full items-center gap-3 rounded-2xl border border-dashed bg-card/60 p-3.5 text-left">
      <span className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
        <Lock className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{c.title}</p>
        <p className="text-xs text-muted-foreground">To'lovdan so'ng ochiladi</p>
      </div>
      <Badge variant="gold">Ochish</Badge>
    </button>
  );
}

export default function LessonDetailPage() {
  const { id } = useParams();
  const lessonId = Number(id);
  const me = useMe();
  const qc = useQueryClient();
  const [payOpen, setPayOpen] = useState(false);
  const q = useQuery({ queryKey: ['lesson', lessonId], queryFn: () => api<LessonDetail>(`/lessons/${lessonId}`) });
  const enroll = useMutation({
    mutationFn: () => api(`/lessons/${lessonId}/enroll`, { method: 'POST' }),
    onSuccess: () => {
      haptic('success');
      qc.invalidateQueries({ queryKey: ['lesson', lessonId] });
      qc.invalidateQueries({ queryKey: ['lessons'] });
    },
  });

  if (q.isLoading) return <div className="pt-4"><ListSkeleton rows={4} /></div>;
  if (q.error) return <div className="pt-4"><ErrorBox error={q.error} /></div>;
  const l = q.data!;
  const isOwner = me.role === 'TEACHER' && l.teacher.user.id === me.id;
  const audio = l.contents.filter((c) => c.type === 'AUDIO');
  const video = l.contents.filter((c) => c.type === 'VIDEO');
  const pdf = l.contents.filter((c) => c.type === 'PDF');
  const color = l.subject.color || '#0E7A5A';
  const needsPay = l.enrolled && l.price > 0 && !l.paidThisPeriod;
  const openPay = () => (l.price > 0 ? setPayOpen(true) : enroll.mutate());

  return (
    <div className="pt-3">
      {/* Шапка урока */}
      <section className="relative overflow-hidden rounded-3xl p-5 text-white shadow-soft" style={{ background: `linear-gradient(140deg, ${color}, ${color}dd 55%, #0B3F31)` }}>
        <div className="ornament absolute inset-0 opacity-60" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <SubjectIcon icon={l.subject.icon} color="rgba(255,255,255,.18)" className="ring-1 ring-white/25" />
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight">{l.subject.name}</h1>
              <p className="text-sm text-white/80">{l.teacher.user.fullName}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 ring-1 ring-white/20">
              <CalendarDays className="size-3.5" /> {WEEKDAYS[l.weekDay]}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 ring-1 ring-white/20">
              <Clock3 className="size-3.5" /> {l.startTime}
              {l.approxStart && !/\d:\d/.test(l.startTime) && ` (~${l.approxStart})`} · {l.endTime}
            </span>
            {l.isContinuous && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C4A15A] px-3 py-1.5 text-[#2b1f08]">
                <InfinityIcon className="size-3.5" /> Davomiy ✓
              </span>
            )}
          </div>
          <div className="mt-4 rounded-2xl bg-black/15 p-3.5 ring-1 ring-white/10">
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-white/65">Bugungi mavzu</p>
            <p className="mt-0.5 text-lg font-extrabold leading-snug">
              <span className="text-[#E2C98D]">{l.currentPageFrom}–{l.currentPageTo}-bet</span> · {l.topic}
            </p>
            {l.nextTopic && <p className="mt-1 text-xs text-white/70">Keyingi: {l.nextTopic}</p>}
          </div>
        </div>
      </section>

      {/* Книга */}
      <div className="mt-4 rounded-2xl border bg-card p-4 shadow-soft">
        <div className="mb-3 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-gold-soft text-gold-foreground dark:text-gold">
            <BookOpenText className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold">{l.bookTitle}</p>
            <p className="text-xs text-muted-foreground">
              Kitob {l.bookTotalPages} bet · {l.progressPercent}% o'tildi
            </p>
          </div>
        </div>
        <BookProgress from={l.currentPageFrom} to={l.currentPageTo} total={l.bookTotalPages} />
      </div>

      {/* Цена и оплата */}
      <div className="mt-3 rounded-2xl border bg-card p-4 shadow-soft">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Narx</p>
            <p className="whitespace-nowrap text-xl font-extrabold">{l.price ? `${som(l.price)} / oy` : 'Bepul'}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            <PriceBadge lesson={l} />
            <PaymentTypeBadge type={l.paymentType} />
          </div>
        </div>
        {!isOwner && (
          <div className="mt-3">
            {!l.enrolled ? (
              <Button className="w-full" size="lg" loading={enroll.isPending} onClick={() => (l.price > 0 ? (enroll.mutate(), setPayOpen(true)) : enroll.mutate())}>
                {l.price > 0 ? `Yozilish va to'lash — ${som(l.price)}` : 'Darsga yozilish'}
              </Button>
            ) : l.paidThisPeriod || l.price === 0 ? (
              <div className="rounded-xl bg-primary/10 p-3 text-center text-sm font-bold text-primary">✓ Siz bu darsga yozilgansiz{l.price ? ` · ${l.period} to'langan` : ''}</div>
            ) : l.pendingPayment ? (
              <div className="rounded-xl bg-gold-soft p-3 text-center text-sm font-bold text-gold-foreground">⏳ To'lov tekshirilmoqda ({som(l.pendingPayment.amount)})</div>
            ) : (
              <Button className="w-full" size="lg" variant="gold" onClick={() => setPayOpen(true)}>
                {l.period} uchun to'lash — {som(l.price)}
              </Button>
            )}
            {enroll.error && <ErrorBox error={enroll.error} />}
          </div>
        )}
        {isOwner && (
          <Button asChild variant="outline" className="mt-3 w-full">
            <Link to={`/teacher/lessons/${l.id}`}>
              <Settings2 /> Darsni boshqarish
            </Link>
          </Button>
        )}
      </div>

      {/* Локация */}
      {l.location && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-soft">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <MapPin className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{l.location.title}</p>
            <p className="truncate text-xs text-muted-foreground">{l.location.address}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => openLink(l.location!.map_url)}>
            <Navigation /> {MAP_PROVIDERS[l.location.provider]}
          </Button>
        </div>
      )}

      {/* Материалы */}
      <SectionTitle>Materiallar</SectionTitle>
      <Tabs defaultValue={audio.length ? 'audio' : video.length ? 'video' : 'pdf'}>
        <TabsList>
          <TabsTrigger value="audio">
            <Headphones /> Audio <span className="text-[10px] opacity-60">{audio.length}</span>
          </TabsTrigger>
          <TabsTrigger value="video">
            <Video /> Video <span className="text-[10px] opacity-60">{video.length}</span>
          </TabsTrigger>
          <TabsTrigger value="pdf">
            <FileText /> PDF <span className="text-[10px] opacity-60">{pdf.length}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="audio" className="space-y-3">
          {!audio.length && <EmptyState title="Audio yo'q" icon={Headphones} />}
          {audio.map((c) => (c.locked || !c.url ? <LockedRow key={c.id} c={c} onPay={openPay} /> : <AudioPlayer key={c.id} url={c.url} title={c.title} />))}
        </TabsContent>
        <TabsContent value="video" className="space-y-3">
          {!video.length && <EmptyState title="Video yo'q" icon={Video} />}
          {video.map((c) => (c.locked || !c.url ? <LockedRow key={c.id} c={c} onPay={openPay} /> : <VideoPlayer key={c.id} url={c.url} title={c.title} />))}
        </TabsContent>
        <TabsContent value="pdf">
          {!pdf.length ? <EmptyState title="PDF yo'q" icon={FileText} /> : <PdfGrid items={pdf} onLocked={openPay} />}
        </TabsContent>
      </Tabs>

      {/* Посещаемость и оценки студента */}
      {l.enrolled && (l.attendances.length > 0 || l.grades.length > 0) && (
        <>
          <SectionTitle>Davomat va baholar</SectionTitle>
          <div className="rounded-2xl border bg-card p-2 shadow-soft">
            {l.grades.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-3 border-b px-2 py-2.5 last:border-0">
                <div>
                  <p className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={cn('size-4', i < g.score ? 'fill-gold text-gold' : 'text-muted')} />
                    ))}
                  </p>
                  {g.comment && <p className="mt-0.5 text-xs text-muted-foreground">{g.comment}</p>}
                </div>
                <span className="text-xs text-muted-foreground">{dateUz(g.createdAt)}</span>
              </div>
            ))}
            {l.attendances.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 border-b px-2 py-2.5 last:border-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {a.session.pageFrom}–{a.session.pageTo}-bet · {a.session.topic}
                  </p>
                  <p className="text-xs text-muted-foreground">{dateUz(a.session.date)}</p>
                </div>
                <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold', ATT[a.status]?.cls)}>{ATT[a.status]?.label}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {l.payments.length > 0 && (
        <>
          <SectionTitle>To'lovlarim</SectionTitle>
          <div className="space-y-2">
            {l.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3 shadow-soft">
                <div>
                  <p className="text-sm font-bold">{som(p.amount)}</p>
                  <p className="text-xs text-muted-foreground">{p.period} · {dateUz(p.createdAt)}</p>
                </div>
                <Badge variant={PAYMENT_STATUS[p.status].tone === 'green' ? 'default' : PAYMENT_STATUS[p.status].tone === 'red' ? 'red' : 'gold'}>
                  {PAYMENT_STATUS[p.status].label}
                </Badge>
              </div>
            ))}
          </div>
        </>
      )}

      {needsPay && !l.pendingPayment && (
        <p className="mt-4 text-center text-xs text-muted-foreground">Pullik materiallar to'lov tasdiqlangach ochiladi.</p>
      )}
      <PaymentSheet lessonId={lessonId} open={payOpen} onOpenChange={setPayOpen} />
    </div>
  );
}
