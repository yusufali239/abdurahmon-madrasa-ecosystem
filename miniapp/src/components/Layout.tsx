import { HandHeart, Home, Library, Newspaper, UserRound } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@shared/lib/utils';
import { haptic } from '@/lib/telegram';

const TABS = [
  { to: '/', label: 'Asosiy', icon: Home, end: true },
  { to: '/lessons', label: 'Darslar', icon: Library },
  { to: '/news', label: 'Yangiliklar', icon: Newspaper },
  { to: '/fund', label: 'Hayriya', icon: HandHeart },
  { to: '/profile', label: 'Profil', icon: UserRound },
];

export function Layout() {
  return (
    <div className="mx-auto min-h-screen max-w-xl">
      <main className="px-4 pb-28 pt-1">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg">
        <div className="mx-auto grid max-w-xl grid-cols-5">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => haptic('light')}
              className={({ isActive }) =>
                cn('flex flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-semibold transition-colors', isActive ? 'text-primary' : 'text-muted-foreground')
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn('grid h-7 w-12 place-items-center rounded-full transition-all', isActive && 'bg-primary/10')}>
                    <Icon className="size-[21px]" strokeWidth={isActive ? 2.4 : 2} />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
