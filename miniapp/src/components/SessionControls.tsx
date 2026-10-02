import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Square } from 'lucide-react';
import { Button } from '@shared/ui/button';
import { Dialog, DialogContent } from '@shared/ui/dialog';
import { Field, Input } from '@shared/ui/input';
import { api } from '@/lib/api';
import { haptic } from '@/lib/telegram';
import { ErrorBox } from './common';

export interface TeacherSession {
  id: number;
  date: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'STARTED' | 'CANCELLED' | 'DONE';
  startsAt: string | null;
  pageFrom: number | null;
  pageTo: number | null;
  topic: string | null;
  cancelReason: string | null;
  lesson: { id: number; bookTitle: string; bookTotalPages: number; currentPage: number | null; topic: string | null; subject: { name: string } };
  _count?: { attendances: number };
}

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    haptic('success');
    qc.invalidateQueries({ queryKey: ['sessions'] });
    qc.invalidateQueries({ queryKey: ['lessons'] });
    qc.invalidateQueries({ queryKey: ['lesson'] });
  };
}

/**
 * ▶ Начать урок. Если страница известна (новая книга или после прошлого урока) — старт сразу.
 * Если книга продолжающаяся и страница неизвестна — спрашиваем «с какой страницы».
 */
export function StartButton({ session, className }: { session: TeacherSession; className?: string }) {
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState('');
  const [topic, setTopic] = useState(session.topic ?? '');
  const known = session.pageFrom ?? session.lesson.currentPage;
  const start = useMutation({
    mutationFn: (body: { pageFrom?: number; topic?: string }) => api(`/sessions/${session.id}/start`, { body }),
    onSuccess: () => {
      setOpen(false);
      refresh();
    },
  });
  return (
    <>
      <Button className={className} loading={start.isPending && !open} onClick={() => (known ? start.mutate({}) : setOpen(true))}>
        <Play className="fill-current" /> Darsni boshlash
      </Button>
      {start.error && !open && <ErrorBox error={start.error} />}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent side="bottom" title="Darsni boshlash" description={`${session.lesson.subject.name} · ${session.lesson.bookTitle}`}>
          <div className="space-y-4">
            <Field label="Qaysi betdan boshlaysiz?">
              <Input autoFocus type="number" inputMode="numeric" value={page} onChange={(e) => setPage(e.target.value)} placeholder="Masalan, 28" />
            </Field>
            <Field label="Bugungi mavzu (ixtiyoriy)">
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Masalan, Halol va harom" />
            </Field>
            {start.error && <ErrorBox error={start.error} />}
            <Button size="lg" className="w-full" disabled={!Number(page)} loading={start.isPending} onClick={() => start.mutate({ pageFrom: Number(page), topic: topic || undefined })}>
              <Play className="fill-current" /> Boshlash
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** ⏹ Закончить урок: до какой страницы дошли и тема следующего урока */
export function FinishButton({ session, className }: { session: TeacherSession; className?: string }) {
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState('');
  const [nextTopic, setNextTopic] = useState('');
  const finish = useMutation({
    mutationFn: () => api(`/sessions/${session.id}/finish`, { body: { pageTo: Number(page), nextTopic: nextTopic || undefined } }),
    onSuccess: () => {
      setOpen(false);
      setPage('');
      setNextTopic('');
      refresh();
    },
  });
  return (
    <>
      <Button className={className} variant="outline" onClick={() => setOpen(true)}>
        <Square className="fill-current" /> Yakunlash
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          side="bottom"
          title="Darsni yakunlash"
          description={session.pageFrom ? `Bugun ${session.pageFrom}-betdan boshlandi` : session.lesson.bookTitle}
        >
          <div className="space-y-4">
            <Field label="Qaysi betgacha o'qildi?">
              <Input
                autoFocus
                type="number"
                inputMode="numeric"
                value={page}
                onChange={(e) => setPage(e.target.value)}
                placeholder={session.pageFrom ? `Masalan, ${session.pageFrom + 10}` : 'Masalan, 28'}
              />
            </Field>
            <Field label="Keyingi darsning mavzusi">
              <Input value={nextTopic} onChange={(e) => setNextTopic(e.target.value)} placeholder="Masalan, Savdo odoblari" />
            </Field>
            {finish.error && <ErrorBox error={finish.error} />}
            <Button size="lg" className="w-full" disabled={!Number(page)} loading={finish.isPending} onClick={() => finish.mutate()}>
              Saqlash
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
