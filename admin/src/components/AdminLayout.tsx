import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookMarked, CreditCard, GraduationCap, HandHeart, LayoutDashboard, LogOut, Menu, Newspaper, Shapes, Users, X } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Logo } from '@shared/ui/logo';
import { ThemeToggle } from '@shared/ui/theme-toggle';
import { cn } from '@shared/lib/utils';
import { api, setToken } from '@/lib/api';

const NAV = [
  { to: '/', label: 'Boshqaruv paneli', icon: LayoutDashboard, end: true },
  { to: '/users', label: 'Foydalanuvchilar', icon: Users, badge: 'pendingUsers' },
  { to: '/teachers', label: 'Ustozlar', icon: GraduationCap },
  { to: '/lessons', label: 'Darslar', icon: BookMarked },
  { to: '/payments', label: "To'lovlar", icon: CreditCard, badge: 'pendingPayments' },
  { to: '/fund', label: "Hayriya jamg'armasi", icon: HandHeart },
  { to: '/news', label: 'Yangiliklar', icon: Newspaper },
  { to: '/subjects', label: 'Fanlar', icon: Shapes },
] as const;

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const stats = useQuery({ queryKey: ['stats'], queryFn: () => api<Record<string, any>>('/admin/stats'), refetchInterval: 30_000 });
  const logout = () => {
    setToken(null);
    navigate('/login');
  };

  const nav = (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV.map((n) => {
        const count = 'badge' in n ? stats.data?.[n.badge] : 0;
        return (
          <NavLink
            key={n.to}
            to={n.to}
            end={'end' in n}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                isActive ? 'bg-primary text-primary-foreground shadow-soft' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            <n.icon className="size-[18px]" />
            <span className="flex-1">{n.label}</span>
            {!!count && <span className="rounded-full bg-gold px-2 py-0.5 text-[11px] font-extrabold text-gold-foreground">{count}</span>}
          </NavLink>
        );
      })}
      <ThemeToggle className="mt-auto self-start" />
      <button onClick={logout} className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted">
        <LogOut className="size-[18px]" /> Chiqish
      </button>
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="ornament sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r bg-card p-5 lg:flex">
        <Logo className="mb-8" subtitle="Admin panel" />
        {nav}
      </aside>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-card/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo subtitle="Admin" />
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-muted" aria-label="Menyu">
          <Menu />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="flex h-full w-72 flex-col bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <Logo subtitle="Admin" />
              <button onClick={() => setOpen(false)}>
                <X />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}
      <main className="min-w-0 flex-1 p-4 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight lg:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{(error as Error).message}</div>;
}

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr:last-child]:border-0 [&_td]:px-4 [&_td]:py-3">{children}</tbody>
      </table>
      {empty && <p className="p-8 text-center text-sm text-muted-foreground">Ma'lumot yo'q</p>}
    </div>
  );
}

export function Stat({ label, value, icon: Icon, tone = 'green' }: { label: string; value: React.ReactNode; icon: any; tone?: 'green' | 'gold' }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground">{label}</p>
        <span className={cn('grid size-9 place-items-center rounded-xl', tone === 'gold' ? 'bg-gold-soft text-gold-foreground' : 'bg-primary/10 text-primary')}>
          <Icon className="size-[18px]" />
        </span>
      </div>
      <p className="mt-2 text-3xl font-extrabold tracking-tight">{value}</p>
    </div>
  );
}
