import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { cn, WEEKDAYS_SHORT } from '@shared/lib/utils';
import { api } from '@/lib/api';
import type { Lesson, Subject } from '@/lib/types';
import { EmptyState, ErrorBox, ListSkeleton, PageHeader } from '@/components/common';
import { LessonCard } from '@/components/LessonCard';

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border px-4 py-2 text-sm transition',
        active ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground',
      )}
    >
      {children}
    </button>
  );
}

export default function LessonsPage() {
  const [params, setParams] = useSearchParams();
  const subjectId = params.get('subject');
  const weekDay = params.get('day');
  const mine = params.get('mine') === '1';
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: () => api<Subject[]>('/subjects') });
  const qs = new URLSearchParams();
  if (subjectId) qs.set('subjectId', subjectId);
  if (weekDay) qs.set('weekDay', weekDay);
  if (mine) qs.set('mine', 'true');
  const lessons = useQuery({ queryKey: ['lessons', qs.toString()], queryFn: () => api<Lesson[]>(`/lessons?${qs}`) });

  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  return (
    <div>
      <PageHeader title="Darslar" />
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-3">
        <Chip active={!subjectId && !mine} onClick={() => setParams({}, { replace: true })}>
          Barchasi
        </Chip>
        <Chip active={mine} onClick={() => set('mine', mine ? null : '1')}>
          ✓ Mening darslarim
        </Chip>
        {subjects.data?.map((s) => (
          <Chip key={s.id} active={subjectId === String(s.id)} onClick={() => set('subject', subjectId === String(s.id) ? null : String(s.id))}>
            {s.name}
          </Chip>
        ))}
      </div>
      <div className="mb-6 grid grid-cols-7 gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
          <button
            key={d}
            onClick={() => set('day', weekDay === String(d) ? null : String(d))}
            className={cn(
              'rounded-xl border py-2.5 text-sm transition',
              weekDay === String(d) ? 'border-primary text-primary' : 'text-muted-foreground',
            )}
          >
            {WEEKDAYS_SHORT[d]}
          </button>
        ))}
      </div>
      {lessons.isLoading && <ListSkeleton />}
      {lessons.error && <ErrorBox error={lessons.error} />}
      {lessons.data && !lessons.data.length && <EmptyState title="Darslar topilmadi" />}
      <div className="space-y-3">
        {lessons.data?.map((l) => (
          <LessonCard key={l.id} lesson={l} />
        ))}
      </div>
    </div>
  );
}
