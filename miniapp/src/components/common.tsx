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
  const c = color || '#0E7A5A';
  return (
    <span className={cn('grid size-11 shrink-0 place-items-center rounded-2xl', className)} style={{ background: `${c}1a`, color: c }}>
      <Icon className="size-5" strokeWidth={2} />
    </span>
  );
}

export function PageHeader({ title, subtitle, back, action }: { title: string; subtitle?: string; back?: boolean; action?: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="mb-6 flex items-center gap-2 pt-4">
      {back && !inTelegram() && (
        <button onClick={() => navigate(-1)} className="-ml-2 rounded-full p-2 hover:bg-muted" aria-label="Orqaga">
          <ChevronLeft className="size-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 mt-10 flex items-center justify-between">
      <h2 className="text-base font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ title, text, icon: Icon = Inbox }: { title: string; text?: string; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-10 text-center">
      <span className="mb-3 grid size-11 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </span>
      <p className="font-semibold">{title}</p>
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

/** Прогресс по книге: сколько страниц уже прочитано из общего числа */
export function BookProgress({ done, total, compact }: { done: number | null; total: number; compact?: boolean }) {
  const pct = done !== null ? Math.max(0, Math.min(100, (done / total) * 100)) : 0;
  return (
    <div>
      <div className={cn('relative w-full overflow-hidden rounded-full bg-muted', compact ? 'h-1' : 'h-1.5')}>
        <div className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      {!compact && (
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{done !== null ? `${done} bet o'qildi` : 'Birinchi darsda belgilanadi'}</span>
          <span>{total} bet</span>
        </div>
      )}
    </div>
  );
}
