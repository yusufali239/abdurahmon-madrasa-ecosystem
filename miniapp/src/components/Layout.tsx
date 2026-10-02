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
      <main className="px-5 pb-32 pt-2">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg">
        <div className="mx-auto grid max-w-xl grid-cols-5">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => haptic('light')}
              className={({ isActive }) =>
                cn('flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors', isActive ? 'text-primary' : 'text-muted-foreground')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="size-[22px]" strokeWidth={isActive ? 2.2 : 1.8} />
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
