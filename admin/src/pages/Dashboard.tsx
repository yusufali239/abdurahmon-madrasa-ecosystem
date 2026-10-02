import { useMutation, useQuery } from '@tanstack/react-query';
import { BookMarked, CalendarClock, CreditCard, GraduationCap, HandHeart, UserCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Progress } from '@shared/ui/progress';
import { som, timeUz, WEEKDAYS } from '@shared/lib/utils';
import { api } from '@/lib/api';
import { PageTitle, Stat } from '@/components/AdminLayout';

const S: Record<string, { label: string; v: any }> = {
  SCHEDULED: { label: 'Tasdiq kutilmoqda', v: 'gold' },
  CONFIRMED: { label: "Bo'ladi", v: 'default' },
  CANCELLED: { label: 'Bekor', v: 'red' },
  DONE: { label: 'Yakunlandi', v: 'muted' },
};

export default function DashboardPage() {
  const q = useQuery({ queryKey: ['stats'], queryFn: () => api<any>('/admin/stats') });
  const cron = useMutation({ mutationFn: () => api('/admin/cron/daily-confirmation', { method: 'POST' }), onSuccess: () => q.refetch() });
  const d = q.data;
  return (
    <div>
      <PageTitle
        title="Assalomu alaykum!"
        subtitle={d ? `Bugun ${WEEKDAYS[d.weekDay]} · Asia/Bishkek` : ''}
        action={
          <Button variant="outline" loading={cron.isPending} onClick={() => cron.mutate()}>
            <CalendarClock /> 08:00 tasdiqni hozir yuborish
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Talabalar" value={d?.students ?? '—'} icon={Users} />
        <Stat label="Ustozlar" value={d?.teachers ?? '—'} icon={GraduationCap} />
        <Stat label="Faol darslar" value={d?.lessons ?? '—'} icon={BookMarked} />
        <Stat label="MBank tushum" value={d ? som(d.mbankConfirmedTotal) : '—'} icon={CreditCard} tone="gold" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Link to="/users?status=PENDING" className="rounded-2xl border border-gold/50 bg-gold-soft p-5 shadow-soft">
          <UserCheck className="mb-2 size-6 text-gold-foreground" />
          <p className="text-3xl font-extrabold">{d?.pendingUsers ?? 0}</p>
          <p className="text-sm font-semibold text-gold-foreground">ta ariza tasdiq kutmoqda</p>
        </Link>
        <Link to="/payments" className="rounded-2xl border border-gold/50 bg-gold-soft p-5 shadow-soft">
          <CreditCard className="mb-2 size-6 text-gold-foreground" />
          <p className="text-3xl font-extrabold">{d?.pendingPayments ?? 0}</p>
          <p className="text-sm font-semibold text-gold-foreground">ta to'lov tekshirilishi kerak</p>
        </Link>
        <Link to="/fund" className="rounded-2xl border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <HandHeart className="size-6 text-primary" />
            {d?.fund.limitReached && <Badge variant="gold">Limitga yetdi!</Badge>}
          </div>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">Umumiy jamg'arma</p>
          <p className="text-2xl font-extrabold">{d ? som(d.fund.globalTotal) : '—'}</p>
          <Progress className="mt-3" value={d?.fund.progressPercent ?? 0} indicatorClassName="from-gold to-[#E2C98D]" />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Qoldiq {d ? som(d.fund.available) : ''} / limit {d ? som(d.fund.limit) : ''}
          </p>
        </Link>
      </div>
      <h2 className="mb-3 mt-8 text-lg font-extrabold">Bugungi mashg'ulotlar</h2>
      <div className="rounded-2xl border bg-card shadow-soft">
        {!d?.todaySessions.length && <p className="p-6 text-sm text-muted-foreground">Bugun hali mashg'ulot yaratilmagan (08:00 cron yoki yuqoridagi tugma).</p>}
        {d?.todaySessions.map((s: any) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5 last:border-0">
            <div>
              <p className="font-bold">
                {s.lesson.subject.name} — {s.lesson.teacher.user.fullName}
              </p>
              <p className="text-xs text-muted-foreground">
                {s.startsAt ? `~${timeUz(s.startsAt)}` : s.lesson.startTime} · {s.pageFrom}–{s.pageTo}-bet «{s.topic}»
                {s.cancelReason && ` · Sabab: ${s.cancelReason}`}
              </p>
            </div>
            <Badge variant={S[s.status].v}>{S[s.status].label}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
