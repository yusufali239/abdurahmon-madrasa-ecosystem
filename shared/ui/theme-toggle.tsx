import { useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '../lib/utils';
import { getThemeMode, setThemeMode, type ThemeMode } from '../lib/theme';

const OPTIONS: Array<{ v: ThemeMode; label: string; icon: typeof Sun }> = [
  { v: 'auto', label: 'Avto', icon: Monitor },
  { v: 'light', label: "Yorug'", icon: Sun },
  { v: 'dark', label: "Qorong'i", icon: Moon },
];

/** Переключатель темы: сегменты «Avto / Yorug' / Qorong'i» */
export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState<ThemeMode>(getThemeMode());
  return (
    <div role="radiogroup" aria-label="Mavzu" className={cn('inline-flex rounded-full bg-muted p-1', className)}>
      {OPTIONS.map(({ v, label, icon: Icon }) => (
        <button
          key={v}
          role="radio"
          aria-checked={mode === v}
          onClick={() => (setMode(v), setThemeMode(v))}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition',
            mode === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
          )}
        >
          <Icon className="size-3.5" /> {label}
        </button>
      ))}
    </div>
  );
}

/** Компактная кнопка: Sun/Moon — переключает светлую и тёмную */
export function ThemeIconButton({ className }: { className?: string }) {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggle = () => {
    const next = dark ? 'light' : 'dark';
    setThemeMode(next);
    setDark(!dark);
  };
  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Yorug' rejim" : "Qorong'i rejim"}
      className={cn('grid size-10 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground', className)}
    >
      {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}
