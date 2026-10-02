import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, Plus, XCircle } from 'lucide-react';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Dialog, DialogContent } from '@shared/ui/dialog';
import { Textarea } from '@shared/ui/input';
import { dateUz, som, timeUz } from '@shared/lib/utils';
import { api } from '@/lib/api';
import { haptic } from '@/lib/telegram';
import type { Lesson } from '@/lib/types';
import { AttendanceSheet } from '@/components/AttendanceSheet';
import { EmptyState, ErrorBox, ListSkeleton, PageHeader, SectionTitle } from '@/components/common';
import { LessonCard } from '@/components/LessonCard';

interface Session {
  id: number;
  date: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'CANCELLED' | 'DONE';
  startsAt: string | null;
  pageFrom: number;
  pageTo: number;
  topic: string;
  cancelReason: string | null;
  lesson: { id: number; subject: { name: string } };
  _count: { attendances: number };
}

const STATUS: Record<Session['status'], { label: string; variant: 'gold' | 'default' | 'red' | 'muted' }> = {
  SCHEDULED: { label: 'Tasdiq kutilmoqda', variant: 'gold' },
  CONFIRMED: { label: 'Bo\'ladi', variant: 'default' },
  CANCELLED: { label: 'Bekor qilindi', variant: 'red' },
  DONE: { label: 'Yakunlandi', variant: 'muted' },
};

export default function TeacherPage() {
  const qc = useQueryClient();
  const lessons = useQuery({ queryKey: ['lessons', 'mine'], queryFn: () => api<Lesson[]>('/lessons?mine=true') });
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => api<Session[]>('/sessions/mine') });
  const fund = useQuery({ queryKey: ['fund'], queryFn: () => api<{ personalTotal: number; globalTotal: number }>('/fund') });
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [attId, setAttId] = useState<number | null>(null);

  const confirm = useMutation({
    mutationFn: (id: number) => api(`/sessions/${id}/confirm`, { method: 'POST' }),
    onSuccess: () => (haptic('success'), qc.invalidateQueries({ queryKey: ['sessions'] })),
  });
  const cancel = useMutation({
    mutationFn: () => api(`/sessions/${cancelId}/cancel`, { body: { reason } }),
    onSuccess: () => {
      haptic('success');
      setCancelId(null);
      setReason('');
      qc.invalidateQueries({ queryKey: ['sessions'] });
    },
  });

  return (
    <div>
      <PageHeader
        title="Ustoz paneli"
        back
        action={
          <Button asChild size="sm">
            <Link to="/teacher/lessons/new">
              <Plus /> Yangi dars
            </Link>
          </Button>
        }
      />

      {fund.data && (
        <Link to="/fund" className="block rounded-2xl border border-gold/40 bg-gold-soft p-4 text-gold-foreground shadow-soft dark:text-gold">
          <p className="text-sm">
            Hayriya jamg'armasi: Sizning hissangiz <b>{som(fund.data.personalTotal)}</b>
          </p>
          <p className="text-sm">
            Umumiy jamg'arma: <b>{som(fund.data.globalTotal)}</b>
          </p>
        </Link>
      )}

      <SectionTitle>Mashg'ulotlar</SectionTitle>
      {sessions.isLoading && <ListSkeleton rows={2} />}
      {sessions.data && !sessions.data.length && <EmptyState title="Mashg'ulotlar yo'q" text="Har kuni 08:00 da botga tasdiq so'rovi keladi." />}
      <div className="space-y-2.5">
        {sessions.data?.map((s) => (
          <div key={s.id} className="rounded-2xl border bg-card p-3.5 shadow-soft">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-extrabold">{s.lesson.subject.name}</p>
                <p className="text-xs text-muted-foreground">
                  {dateUz(s.date)}
                  {s.startsAt && ` · ~${timeUz(s.startsAt)}`} · {s.pageFrom}–{s.pageTo}-bet «{s.topic}»
                </p>
                {s.cancelReason && <p className="mt-1 text-xs text-destructive">Sabab: {s.cancelReason}</p>}
              </div>
              <Badge variant={STATUS[s.status].variant}>{STATUS[s.status].label}</Badge>
            </div>
            <div className="mt-3 flex gap-2">
              {s.status === 'SCHEDULED' && (
                <>
                  <Button size="sm" className="flex-1" loading={confirm.isPending && confirm.variables === s.id} onClick={() => confirm.mutate(s.id)}>
                    <CheckCircle2 /> Ha, bo'ladi
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setCancelId(s.id)}>
                    <XCircle /> Yo'q
                  </Button>
                </>
              )}
              {s.status !== 'CANCELLED' && (
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => setAttId(s.id)}>
                  <ClipboardCheck /> Davomat {s._count.attendances ? `(${s._count.attendances})` : ''}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      {confirm.error && <ErrorBox error={confirm.error} />}

      <SectionTitle>Mening darslarim</SectionTitle>
      {lessons.data && !lessons.data.length && <EmptyState title="Darslar yo'q" text="«Yangi dars» tugmasi orqali dars yarating." />}
      <div className="space-y-3">
        {lessons.data?.map((l) => (
          <LessonCard key={l.id} lesson={l} to={`/teacher/lessons/${l.id}`} />
        ))}
      </div>

      <Dialog open={!!cancelId} onOpenChange={(v) => !v && setCancelId(null)}>
        <DialogContent side="bottom" title="Darsni bekor qilish" description="Sabab majburiy — talabalarga yuboriladi">
          <Textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Masalan: Betobman" />
          {cancel.error && <ErrorBox error={cancel.error} />}
          <Button className="mt-3 w-full" variant="destructive" size="lg" disabled={reason.trim().length < 3} loading={cancel.isPending} onClick={() => cancel.mutate()}>
            Bekor qilish va xabar yuborish
          </Button>
        </DialogContent>
      </Dialog>
      <AttendanceSheet sessionId={attId} onOpenChange={(v) => !v && setAttId(null)} />
    </div>
  );
}
