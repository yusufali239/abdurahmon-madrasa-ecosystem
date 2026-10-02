import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@shared/ui/button';
import { Dialog, DialogContent } from '@shared/ui/dialog';
import { Textarea } from '@shared/ui/input';
import { cn, dateUz, pageTopic, som, timeUz } from '@shared/lib/utils';
import { api } from '@/lib/api';
import { haptic } from '@/lib/telegram';
import type { Lesson } from '@/lib/types';
import { AttendanceSheet } from '@/components/AttendanceSheet';
import { EmptyState, ErrorBox, ListSkeleton, PageHeader, SectionTitle } from '@/components/common';
import { LessonCard } from '@/components/LessonCard';
import { FinishButton, StartButton, type TeacherSession } from '@/components/SessionControls';

const STATUS: Record<TeacherSession['status'], { label: string; cls: string }> = {
  SCHEDULED: { label: 'Tasdiqlanmagan', cls: 'text-muted-foreground' },
  CONFIRMED: { label: "Bo'ladi", cls: 'text-primary' },
  STARTED: { label: 'Dars ketmoqda', cls: 'text-primary' },
  CANCELLED: { label: 'Bekor qilindi', cls: 'text-destructive' },
  DONE: { label: 'Yakunlandi', cls: 'text-muted-foreground' },
};

export default function TeacherPage() {
  const qc = useQueryClient();
  const lessons = useQuery({ queryKey: ['lessons', 'mine'], queryFn: () => api<Lesson[]>('/lessons?mine=true') });
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => api<TeacherSession[]>('/sessions/mine') });
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

      <SectionTitle>Mashg'ulotlar</SectionTitle>
      {sessions.isLoading && <ListSkeleton rows={2} />}
      {sessions.data && !sessions.data.length && <EmptyState title="Bugun dars yo'q" text="Dars kunlari bu yerda «Darsni boshlash» tugmasi chiqadi." />}
      <div className="space-y-3">
        {sessions.data?.map((s) => {
          const info =
            s.status === 'DONE' && s.pageTo
              ? `${s.pageFrom}–${s.pageTo}-bet o'qildi`
              : pageTopic(s.pageFrom ?? s.lesson.currentPage, s.topic ?? s.lesson.topic);
          return (
            <div key={s.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-semibold">{s.lesson.subject.name}</p>
                <span className={cn('text-xs font-medium', STATUS[s.status].cls)}>{STATUS[s.status].label}</span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {dateUz(s.date)}
                {s.startsAt && ` · ~${timeUz(s.startsAt)}`}
                {info && ` · ${info}`}
              </p>
              {s.cancelReason && <p className="mt-1 text-sm text-destructive">Sabab: {s.cancelReason}</p>}

              {s.status !== 'CANCELLED' && (
                <div className="mt-4 space-y-2">
                  {(s.status === 'SCHEDULED' || s.status === 'CONFIRMED') && <StartButton session={s} className="w-full" />}
                  {s.status === 'STARTED' && <FinishButton session={s} className="w-full" />}
                  <div className="flex gap-2">
                    {s.status === 'SCHEDULED' && (
                      <>
                        <Button size="sm" variant="ghost" className="flex-1" onClick={() => confirm.mutate(s.id)}>
                          Bo'ladi deb xabar berish
                        </Button>
                        <Button size="sm" variant="ghost" className="flex-1 text-destructive" onClick={() => setCancelId(s.id)}>
                          Bekor qilish
                        </Button>
                      </>
                    )}
                    {s.status !== 'SCHEDULED' && (
                      <Button size="sm" variant="ghost" className="flex-1" onClick={() => setAttId(s.id)}>
                        Davomat{s._count?.attendances ? ` (${s._count.attendances})` : ''}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {confirm.error && <ErrorBox error={confirm.error} />}

      <SectionTitle>Mening darslarim</SectionTitle>
      {lessons.data && !lessons.data.length && <EmptyState title="Darslar yo'q" text="«Yangi dars» tugmasi orqali qo'shing." />}
      <div className="space-y-3">
        {lessons.data?.map((l) => (
          <LessonCard key={l.id} lesson={l} to={`/teacher/lessons/${l.id}`} />
        ))}
      </div>

      {fund.data && (
        <Link to="/fund" className="mt-10 block rounded-2xl border bg-card p-4 text-sm">
          <p className="text-muted-foreground">Hayriya jamg'armasi</p>
          <p className="mt-1">
            Sizning hissangiz: <b>{som(fund.data.personalTotal)}</b>
          </p>
          <p>
            Umumiy jamg'arma: <b>{som(fund.data.globalTotal)}</b>
          </p>
        </Link>
      )}

      <Dialog open={!!cancelId} onOpenChange={(v) => !v && setCancelId(null)}>
        <DialogContent side="bottom" title="Darsni bekor qilish" description="Sabab talabalarga yuboriladi">
          <Textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Masalan: Betobman" />
          {cancel.error && <ErrorBox error={cancel.error} />}
          <Button className="mt-4 w-full" variant="destructive" size="lg" disabled={reason.trim().length < 3} loading={cancel.isPending} onClick={() => cancel.mutate()}>
            Bekor qilish
          </Button>
        </DialogContent>
      </Dialog>
      <AttendanceSheet sessionId={attId} onOpenChange={(v) => !v && setAttId(null)} />
    </div>
  );
}
