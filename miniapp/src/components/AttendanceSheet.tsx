import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@shared/ui/button';
import { Dialog, DialogContent } from '@shared/ui/dialog';
import { cn, dateUz } from '@shared/lib/utils';
import { api } from '@/lib/api';
import { haptic } from '@/lib/telegram';
import { ErrorBox } from './common';

type Status = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
const OPTIONS: Array<{ v: Status; label: string; cls: string }> = [
  { v: 'PRESENT', label: 'Keldi', cls: 'bg-primary text-primary-foreground' },
  { v: 'LATE', label: 'Kechikdi', cls: 'bg-gold text-gold-foreground' },
  { v: 'ABSENT', label: 'Kelmadi', cls: 'bg-destructive text-destructive-foreground' },
  { v: 'EXCUSED', label: 'Sababli', cls: 'bg-secondary text-secondary-foreground' },
];

interface AttendanceResp {
  session: { id: number; date: string; pageFrom: number; pageTo: number; topic: string; status: string; lesson: { subject: { name: string } } };
  items: Array<{ student: { id: number; fullName: string }; status: Status | null }>;
}

/** Отметка посещаемости занятия */
export function AttendanceSheet({ sessionId, onOpenChange }: { sessionId: number | null; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['attendance', sessionId], queryFn: () => api<AttendanceResp>(`/sessions/${sessionId}/attendance`), enabled: !!sessionId });
  const [marks, setMarks] = useState<Record<number, Status>>({});
  useEffect(() => {
    if (q.data) setMarks(Object.fromEntries(q.data.items.map((i) => [i.student.id, i.status ?? 'PRESENT'])));
  }, [q.data]);
  const save = useMutation({
    mutationFn: () =>
      api(`/sessions/${sessionId}/attendance`, {
        method: 'PUT',
        body: { items: Object.entries(marks).map(([studentId, status]) => ({ studentId: Number(studentId), status })), finish: true },
      }),
    onSuccess: () => {
      haptic('success');
      qc.invalidateQueries({ queryKey: ['sessions'] });
      onOpenChange(false);
    },
  });
  const s = q.data?.session;
  return (
    <Dialog open={!!sessionId} onOpenChange={onOpenChange}>
      <DialogContent
        side="bottom"
        title="Davomat"
        description={s ? `${s.lesson.subject.name} · ${dateUz(s.date)} · ${s.pageFrom}–${s.pageTo}-bet «${s.topic}»` : ''}
      >
        {q.error && <ErrorBox error={q.error} />}
        {q.data && !q.data.items.length && <p className="py-6 text-center text-sm text-muted-foreground">Bu darsga hali talabalar yozilmagan.</p>}
        <div className="space-y-2.5">
          {q.data?.items.map((i) => (
            <div key={i.student.id} className="rounded-2xl border bg-card p-3">
              <p className="mb-2 text-sm font-bold">{i.student.fullName}</p>
              <div className="grid grid-cols-4 gap-1.5">
                {OPTIONS.map((o) => (
                  <button
                    key={o.v}
                    onClick={() => (haptic('light'), setMarks({ ...marks, [i.student.id]: o.v }))}
                    className={cn('rounded-lg py-1.5 text-[11px] font-bold transition', marks[i.student.id] === o.v ? o.cls : 'bg-muted text-muted-foreground')}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {save.error && <ErrorBox error={save.error} />}
        {!!q.data?.items.length && (
          <Button size="lg" className="mt-4 w-full" loading={save.isPending} onClick={() => save.mutate()}>
            Saqlash va yakunlash
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
