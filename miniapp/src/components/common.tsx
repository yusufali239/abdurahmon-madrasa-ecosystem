import { ChevronLeft, Inbox } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Languages, Scale, ScrollText, Sparkles, type LucideIcon } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { Skeleton } from '@shared/ui/skeleton';
import { inTelegram } from '@/lib/telegram';

const ICONS: Record<string, LucideIcon> = {
  scale: Scale,
  sparkles: Sparkles,
  languages: Languages,
  'book-open': BookOpen,
  scroll: ScrollText,
};

export function SubjectIcon({ icon, color, className }: { icon?: string | null; color?: string | null; className?: string }) {
  const Icon = ICONS[icon || ''] ?? BookOpen;
  return (
    <span
      className={cn('grid size-11 shrink-0 place-items-center rounded-2xl text-white shadow-sm', className)}
      style={{ background: `linear-gradient(135deg, ${color || '#0E7A5A'}, ${color || '#0E7A5A'}cc)` }}
    >
      <Icon className="size-5" strokeWidth={2.2} />
    </span>
  );
}

export function PageHeader({ title, subtitle, back, action }: { title: string; subtitle?: string; back?: boolean; action?: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 -mx-4 mb-3 flex items-center gap-2 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur-md">
      {back && !inTelegram() && (
        <button onClick={() => navigate(-1)} className="-ml-1.5 rounded-full p-1.5 hover:bg-muted" aria-label="Orqaga">
          <ChevronLeft className="size-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-2.5 mt-6 flex items-center justify-between">
      <h2 className="text-[13px] font-extrabold uppercase tracking-[.12em] text-muted-foreground">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ title, text, icon: Icon = Inbox }: { title: string; text?: string; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card/50 px-6 py-10 text-center">
      <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-gold-soft text-gold-foreground dark:text-gold">
        <Icon className="size-6" />
      </span>
      <p className="font-bold">{title}</p>
      {text && <p className="mt-1 text-sm text-muted-foreground">{text}</p>}
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full" />
      ))}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      {(error as Error)?.message || 'Xatolik yuz berdi'}
    </div>
  );
}

/** Прогресс по книге: 56–72 / 200 бет */
export function BookProgress({ from, to, total, compact }: { from: number; to: number; total: number; compact?: boolean }) {
  const done = Math.max(0, Math.min(100, ((from - 1) / total) * 100));
  const today = Math.max(0, Math.min(100 - done, ((to - from + 1) / total) * 100));
  return (
    <div>
      <div className={cn('relative w-full overflow-hidden rounded-full bg-muted', compact ? 'h-1.5' : 'h-2.5')}>
        <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${done}%` }} />
        <div className="absolute inset-y-0 rounded-r-full bg-gold" style={{ left: `${done}%`, width: `${today}%` }} />
      </div>
      {!compact && (
        <div className="mt-1.5 flex justify-between text-[11px] font-medium text-muted-foreground">
          <span>
            O'tildi: <b className="text-foreground">{from - 1}</b> bet
          </span>
          <span className="text-gold-foreground dark:text-gold">
            Bugun: {from}–{to}
          </span>
          <span>Jami: {total}</span>
        </div>
      )}
    </div>
  );
}
