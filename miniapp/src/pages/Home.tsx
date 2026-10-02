import { useQuery } from '@tanstack/react-query';
import { ChevronRight, GraduationCap, HandHeart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '@shared/ui/logo';
import { Progress } from '@shared/ui/progress';
import { cn, dateUz, NEWS_TYPES, som } from '@shared/lib/utils';
import { api } from '@/lib/api';
import { useMe } from '@/lib/me';
import type { FundSummary, Lesson, News, Subject } from '@/lib/types';
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
  const fund = useQuery({ queryKey: ['fund'], queryFn: () => api<FundSummary>('/fund') });
  const firstName = (me.fullName || '').split(' ').slice(-1)[0];

  return (
    <div className="pt-3">
      <div className="mb-4 flex items-center justify-between">
        <Logo />
        {me.role === 'TEACHER' && (
          <Link to="/teacher" className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-soft">
            <GraduationCap className="size-4" /> Ustoz paneli
          </Link>
        )}
      </div>

      {/* Приветствие + время намазов */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B5E46] via-[#0E7A5A] to-[#14936d] p-5 text-white shadow-soft">
        <div className="ornament absolute inset-0 opacity-70" />
        <div className="relative">
          <p className="font-arabic text-lg text-[#E2C98D]">السَّلَامُ عَلَيْكُمْ</p>
          <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight">Assalomu alaykum, {firstName}!</h1>
          <p className="mt-1 text-sm text-white/75">
            {today.data ? `${today.data.weekDayName}, ${today.data.date} · ${today.data.city}` : ' '}
          </p>
          <div className="mt-4 grid grid-cols-6 gap-1 rounded-2xl bg-black/15 p-1.5 ring-1 ring-white/10">
            {(today.data?.prayers ?? Array.from({ length: 6 }, (_, i) => ({ key: String(i), name: '—', time: '--:--' }))).map((p) => (
              <div
                key={p.key}
                className={cn('rounded-xl px-0.5 py-1.5 text-center', p.key === today.data?.next && 'bg-[#C4A15A] text-[#2b1f08] shadow-gold')}
              >
                <p className="truncate text-[8.5px] font-bold uppercase opacity-80">{p.name}</p>
                <p className="text-[13px] font-extrabold tabular-nums">{p.time}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SectionTitle action={<Link to="/lessons" className="text-xs font-bold text-primary">Barchasi</Link>}>Bugungi darslar</SectionTitle>
      {lessons.isLoading ? (
        <ListSkeleton rows={1} />
      ) : lessons.data?.length ? (
        <div className="space-y-3">
          {lessons.data.map((l) => (
            <LessonCard key={l.id} lesson={l} />
          ))}
        </div>
      ) : (
        <EmptyState title="Bugun dars yo'q" text="Darslar ro'yxatidan o'zingizga mos darsni tanlang." />
      )}

      <SectionTitle>Fanlar</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        {subjects.data?.map((s, i) => (
          <Link
            key={s.id}
            to={`/lessons?subject=${s.id}`}
            className={cn('group relative animate-fade-up overflow-hidden rounded-2xl border bg-card p-3.5 shadow-soft transition active:scale-[.98]', i === 0 && 'col-span-2')}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="absolute -right-6 -top-6 size-24 rounded-full opacity-10" style={{ background: s.color || '#0E7A5A' }} />
            <div className="relative flex items-center gap-3">
              <SubjectIcon icon={s.icon} color={s.color} />
              <div className="min-w-0">
                <p className="font-extrabold">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s._count?.lessons ?? 0} ta dars</p>
              </div>
            </div>
            {i === 0 && s.description && <p className="relative mt-2 text-xs text-muted-foreground">{s.description}</p>}
          </Link>
        ))}
      </div>

      {fund.data && (
        <Link to="/fund" className="mt-6 block rounded-2xl border border-gold/40 bg-gradient-to-br from-gold-soft to-card p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid size-10 place-items-center rounded-xl bg-gold text-gold-foreground">
                <HandHeart className="size-5" />
              </span>
              <div>
                <p className="text-sm font-extrabold">Hayriya jamg'armasi</p>
                <p className="text-xs text-muted-foreground">Umumiy: {som(fund.data.globalTotal)}</p>
              </div>
            </div>
            <ChevronRight className="size-5 text-muted-foreground" />
          </div>
          <Progress value={fund.data.progressPercent} className="mt-3 bg-gold/15" indicatorClassName="from-gold to-[#E2C98D]" />
        </Link>
      )}

      <SectionTitle action={<Link to="/news" className="text-xs font-bold text-primary">Barchasi</Link>}>Yangiliklar</SectionTitle>
      <div className="space-y-2.5">
        {news.data?.slice(0, 3).map((n) => (
          <Link key={n.id} to="/news" className="flex gap-3 rounded-2xl border bg-card p-3 shadow-soft">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-xl">{NEWS_TYPES[n.type]?.emoji}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{n.title}</p>
              <p className="text-xs text-muted-foreground">
                {NEWS_TYPES[n.type]?.label} · {dateUz(n.createdAt)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
