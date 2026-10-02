import { useQuery } from '@tanstack/react-query';
import { ChevronRight, GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LogoMark } from '@shared/ui/logo';
import { ThemeIconButton } from '@shared/ui/theme-toggle';
import { cn, dateUz, NEWS_TYPES } from '@shared/lib/utils';
import { api } from '@/lib/api';
import { useMe } from '@/lib/me';
import type { Lesson, News, Subject } from '@/lib/types';
import { EmptyState, ListSkeleton, SectionTitle, SubjectIcon } from '@/components/common';
import { LessonCard } from '@/components/LessonCard';

interface Today {
  weekDayName: string;
  date: string;
  city: string;
  next: string;
  prayers: Array<{ key: string; name: string; time: string }>;
}

export default function HomePage() {
  const me = useMe();
  const today = useQuery({ queryKey: ['today'], queryFn: () => api<Today>('/meta/today') });
  const lessons = useQuery({ queryKey: ['lessons', 'today'], queryFn: () => api<Lesson[]>('/lessons/today') });
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: () => api<Subject[]>('/subjects') });
  const news = useQuery({ queryKey: ['news', 'all'], queryFn: () => api<News[]>('/news') });
  const firstName = (me.fullName || '').split(' ').slice(-1)[0];
  const prayers = today.data?.prayers.filter((p) => p.key !== 'quyosh') ?? [];

  return (
    <div className="pt-4">
      <div className="flex items-center justify-between">
        <LogoMark className="size-9" />
        <div className="flex items-center gap-1">
          {me.role === 'TEACHER' && (
            <Link to="/teacher" className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground">
              <GraduationCap className="size-4" /> Ustoz paneli
            </Link>
          )}
          <ThemeIconButton />
        </div>
      </div>

      <div className="mt-8">
        <p className="text-sm text-muted-foreground">{today.data ? `${today.data.weekDayName}, ${today.data.date}` : ' '}</p>
        <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight">Assalomu alaykum, {firstName}</h1>
      </div>

      {/* Время намазов — одна спокойная строка, следующий намаз выделен */}
      <div className="mt-6 grid grid-cols-5 rounded-2xl border bg-card py-3">
        {(prayers.length ? prayers : Array.from({ length: 5 }, (_, i) => ({ key: String(i), name: ' ', time: '--:--' }))).map((p) => {
          const next = p.key === today.data?.next;
          return (
            <div key={p.key} className="text-center">
              <p className={cn('text-[11px]', next ? 'font-semibold text-primary' : 'text-muted-foreground')}>{p.name}</p>
              <p className={cn('mt-0.5 text-sm tabular-nums', next ? 'font-bold text-primary' : 'font-medium')}>{p.time}</p>
            </div>
          );
        })}
      </div>

      <SectionTitle>Bugungi darslar</SectionTitle>
      {lessons.isLoading ? (
        <ListSkeleton rows={1} />
      ) : lessons.data?.length ? (
        <div className="space-y-3">
          {lessons.data.map((l) => (
            <LessonCard key={l.id} lesson={l} />
          ))}
        </div>
      ) : (
        <EmptyState title="Bugun dars yo'q" text="Barcha darslar «Darslar» bo'limida." />
      )}

      <SectionTitle>Fanlar</SectionTitle>
      <div className="divide-y rounded-2xl border bg-card">
        {subjects.data?.map((s) => (
          <Link key={s.id} to={`/lessons?subject=${s.id}`} className="flex items-center gap-3.5 px-4 py-3.5">
            <SubjectIcon icon={s.icon} color={s.color} className="size-10 rounded-xl" />
            <span className="flex-1 font-medium">{s.name}</span>
            <span className="text-sm text-muted-foreground">{s._count?.lessons ?? 0}</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        ))}
      </div>

      {!!news.data?.length && (
        <>
          <SectionTitle action={<Link to="/news" className="text-sm font-medium text-primary">Barchasi</Link>}>Yangiliklar</SectionTitle>
          <div className="divide-y rounded-2xl border bg-card">
            {news.data.slice(0, 2).map((n) => (
              <Link key={n.id} to="/news" className="block px-4 py-3.5">
                <p className="text-xs text-muted-foreground">
                  {NEWS_TYPES[n.type]?.label} · {dateUz(n.createdAt)}
                </p>
                <p className="mt-0.5 truncate font-medium">{n.title}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
