import { useQuery } from '@tanstack/react-query';
import { pageTopic, timeUz } from '@shared/lib/utils';
import { api } from '@/lib/api';
import { EmptyState, ListSkeleton } from './common';
import { FinishButton, StartButton, type TeacherSession } from './SessionControls';

/** Виджет учителя на главном экране: сегодняшние уроки с кнопками ▶ начать / ⏹ закончить */
export function TodayLessonsWidget() {
  const q = useQuery({ queryKey: ['sessions'], queryFn: () => api<TeacherSession[]>('/sessions/mine') });
  if (q.isLoading) return <ListSkeleton rows={1} />;
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bishkek' }).format(new Date());
  const today = (q.data ?? []).filter((s) => s.date.slice(0, 10) === todayKey);
  if (!today.length) return <EmptyState title="Bugun dars yo'q" />;
  return (
    <div className="space-y-3">
      {today.map((s) => {
        const info =
          s.status === 'DONE' && s.pageTo
            ? `${s.pageFrom}–${s.pageTo}-bet o'qildi`
            : s.status === 'CANCELLED'
              ? `Bekor qilindi${s.cancelReason ? `: ${s.cancelReason}` : ''}`
              : pageTopic(s.pageFrom ?? s.lesson.currentPage, s.topic ?? s.lesson.topic);
        return (
          <div key={s.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold">{s.lesson.subject.name}</p>
              {s.startsAt && <span className="text-sm text-muted-foreground">~{timeUz(s.startsAt)}</span>}
            </div>
            {info && <p className="mt-0.5 text-sm text-muted-foreground">{info}</p>}
            {(s.status === 'SCHEDULED' || s.status === 'CONFIRMED') && <StartButton session={s} className="mt-4 w-full" />}
            {s.status === 'STARTED' && <FinishButton session={s} className="mt-4 w-full" />}
          </div>
        );
      })}
    </div>
  );
}
