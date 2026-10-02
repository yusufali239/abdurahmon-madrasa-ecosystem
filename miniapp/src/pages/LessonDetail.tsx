import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Clock3, FileText, Headphones, Lock, MapPin, Settings2, Star, Video } from 'lucide-react';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs';
import { cn, dateUz, daysText, MAP_PROVIDERS, PAYMENT_STATUS, pageTopic, som } from '@shared/lib/utils';
import { api } from '@/lib/api';
import { useMe } from '@/lib/me';
import { haptic, openLink } from '@/lib/telegram';
import type { ContentItem, LessonDetail } from '@/lib/types';
import { AudioPlayer } from '@/components/AudioPlayer';
import { BookProgress, EmptyState, ErrorBox, ListSkeleton, SectionTitle, SubjectIcon } from '@/components/common';
import { priceText } from '@/components/LessonCard';
import { PaymentSheet } from '@/components/PaymentSheet';
import { PdfGrid } from '@/components/PdfGrid';
import { VideoPlayer } from '@/components/VideoPlayer';

const ATT: Record<string, { label: string; cls: string }> = {
  PRESENT: { label: 'Keldi', cls: 'text-primary' },
  LATE: { label: 'Kechikdi', cls: 'text-gold-foreground dark:text-gold' },
  ABSENT: { label: 'Kelmadi', cls: 'text-destructive' },
  EXCUSED: { label: 'Sababli', cls: 'text-muted-foreground' },
};

function LockedRow({ c, onPay }: { c: ContentItem; onPay: () => void }) {
  return (
    <button onClick={onPay} className="flex w-full items-center gap-3 rounded-2xl border p-4 text-left">
      <Lock className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-sm">{c.title}</span>
      <span className="text-xs font-medium text-primary">To'lovdan keyin</span>
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

  if (q.isLoading) return <div className="pt-6"><ListSkeleton rows={3} /></div>;
  if (q.error) return <div className="pt-6"><ErrorBox error={q.error} /></div>;
  const l = q.data!;
  const isOwner = me.role === 'TEACHER' && l.teacher.user.id === me.id;
  const isStudent = me.role === 'STUDENT';
  const audio = l.contents.filter((c) => c.type === 'AUDIO');
  const video = l.contents.filter((c) => c.type === 'VIDEO');
  const pdf = l.contents.filter((c) => c.type === 'PDF');
  const next = pageTopic(l.currentPage, l.topic);
  const openPay = () => (l.price > 0 ? setPayOpen(true) : enroll.mutate());

  return (
    <div className="pt-6">
      <div className="flex items-start gap-4">
        <SubjectIcon icon={l.subject.icon} color={l.subject.color} className="size-14 rounded-2xl" />
        <div className="min-w-0 pt-0.5">
          <h1 className="text-2xl font-bold tracking-tight">{l.subject.name}</h1>
          <p className="text-muted-foreground">{l.teacher.user.fullName}</p>
        </div>
      </div>

      <div className="mt-6 space-y-3 text-[15px]">
        <p className="flex items-center gap-3">
          <Clock3 className="size-4 shrink-0 text-muted-foreground" />
          <span>
            {daysText(l.weekDays, true)} · {l.startTime}
            {l.approxStart && !/\d:\d/.test(l.startTime) && <span className="text-muted-foreground"> (~{l.approxStart})</span>} · {l.endTime}
          </span>
        </p>
        {l.location && (
          <button className="flex w-full items-center gap-3 text-left" onClick={() => openLink(l.location!.map_url)}>
            <MapPin className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{l.location.title}</span>
            <span className="text-sm font-medium text-primary">{MAP_PROVIDERS[l.location.provider]}</span>
          </button>
        )}
      </div>

      {/* Книга и следующий урок */}
      <div className="mt-6 rounded-2xl border bg-card p-5">
        <p className="text-sm text-muted-foreground">{l.bookTitle}</p>
        {next ? <p className="mt-1 text-lg font-semibold">{next}</p> : <p className="mt-1 text-lg font-semibold">Keyingi dars</p>}
        <div className="mt-4">
          <BookProgress done={l.pagesDone} total={l.bookTotalPages} />
        </div>
      </div>

      {/* Цена и оплата за день */}
      {isStudent && (
        <div className="mt-3 rounded-2xl border bg-card p-5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Narx</span>
            <span className="text-lg font-semibold">{priceText(l.price)}</span>
          </div>
          <div className="mt-4">
            {!l.enrolled ? (
              <Button className="w-full" loading={enroll.isPending} onClick={() => enroll.mutate()}>
                Darsga yozilish
              </Button>
            ) : l.price === 0 ? (
              <p className="text-center text-sm text-primary">Siz bu darsga yozilgansiz</p>
            ) : l.paidNext ? (
              <p className="text-center text-sm text-primary">Keyingi dars to'langan ✓</p>
            ) : l.pendingNext ? (
              <p className="text-center text-sm text-muted-foreground">To'lov tekshirilmoqda</p>
            ) : (
              <Button className="w-full" onClick={() => setPayOpen(true)}>
                To'lash · {som(l.price)}
              </Button>
            )}
            {enroll.error && <div className="mt-3"><ErrorBox error={enroll.error} /></div>}
          </div>
        </div>
      )}

      {isOwner && (
        <Button asChild variant="outline" className="mt-3 w-full">
          <Link to={`/teacher/lessons/${l.id}`}>
            <Settings2 /> Darsni boshqarish
          </Link>
        </Button>
      )}

      {/* Материалы */}
      {l.contents.length > 0 && (
        <>
          <SectionTitle>Materiallar</SectionTitle>
          <Tabs defaultValue={audio.length ? 'audio' : video.length ? 'video' : 'pdf'}>
            <TabsList>
              <TabsTrigger value="audio">
                <Headphones /> Audio
              </TabsTrigger>
              <TabsTrigger value="video">
                <Video /> Video
              </TabsTrigger>
              <TabsTrigger value="pdf">
                <FileText /> PDF
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
            <TabsContent value="pdf">{!pdf.length ? <EmptyState title="PDF yo'q" icon={FileText} /> : <PdfGrid items={pdf} onLocked={openPay} />}</TabsContent>
          </Tabs>
        </>
      )}

      {/* Оценки и посещаемость ученика */}
      {l.enrolled && (l.grades.length > 0 || l.attendances.length > 0) && (
        <>
          <SectionTitle>Davomat va baholar</SectionTitle>
          <div className="divide-y rounded-2xl border bg-card">
            {l.grades.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div>
                  <p className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={cn('size-4', i < g.score ? 'fill-gold text-gold' : 'text-muted')} />
                    ))}
                  </p>
                  {g.comment && <p className="mt-1 text-sm text-muted-foreground">{g.comment}</p>}
                </div>
                <span className="text-xs text-muted-foreground">{dateUz(g.createdAt)}</span>
              </div>
            ))}
            {l.attendances.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm">{dateUz(a.session.date)}</p>
                  {a.session.pageFrom && (
                    <p className="truncate text-xs text-muted-foreground">
                      {a.session.pageFrom}
                      {a.session.pageTo ? `–${a.session.pageTo}` : ''}-bet{a.session.topic ? ` · ${a.session.topic}` : ''}
                    </p>
                  )}
                </div>
                <span className={cn('text-sm font-medium', ATT[a.status]?.cls)}>{ATT[a.status]?.label}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {isStudent && l.payments.length > 0 && (
        <>
          <SectionTitle>To'lovlarim</SectionTitle>
          <div className="divide-y rounded-2xl border bg-card">
            {l.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <p className="text-sm font-medium">{som(p.amount)}</p>
                  <p className="text-xs text-muted-foreground">{p.period ? dateUz(p.period) : dateUz(p.createdAt)} darsi</p>
                </div>
                <Badge variant={PAYMENT_STATUS[p.status].tone === 'green' ? 'default' : PAYMENT_STATUS[p.status].tone === 'red' ? 'red' : 'muted'}>
                  {PAYMENT_STATUS[p.status].label}
                </Badge>
              </div>
            ))}
          </div>
        </>
      )}
      <PaymentSheet lessonId={lessonId} open={payOpen} onOpenChange={setPayOpen} />
    </div>
  );
}
