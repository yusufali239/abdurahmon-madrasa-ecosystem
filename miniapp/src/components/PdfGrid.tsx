import { FileText, Lock } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { openLink } from '@/lib/telegram';
import type { ContentItem } from '@/lib/types';

/** Сетка PDF-материалов: обложка-«книга» с орнаментом */
export function PdfGrid({ items, onLocked }: { items: ContentItem[]; onLocked?: () => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((c, i) => (
        <button
          key={c.id}
          onClick={() => (c.locked || !c.url ? onLocked?.() : openLink(c.url))}
          className="group animate-fade-up text-left"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <div
            className={cn(
              'relative aspect-[3/4] overflow-hidden rounded-2xl border transition group-active:scale-[.98]',
              i % 2 ? 'bg-gradient-to-br from-[#0B5E46] to-[#0E7A5A]' : 'bg-gradient-to-br from-[#8A6A2F] to-[#C4A15A]',
            )}
          >
            <div className="ornament absolute inset-0 opacity-70" />
            <div className="absolute inset-y-0 left-3 w-px bg-white/25" />
            <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center text-white">
              <FileText className="mb-2 size-8 opacity-90" />
              <p className="line-clamp-3 text-xs font-bold leading-snug">{c.title}</p>
            </div>
            <span className="absolute right-2 top-2 rounded-md bg-black/25 px-1.5 py-0.5 text-[10px] font-bold text-white">PDF</span>
            {c.locked && (
              <div className="absolute inset-0 grid place-items-center bg-black/45 backdrop-blur-[1px]">
                <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-brand-ink">
                  <Lock className="size-3.5" /> Pullik
                </span>
              </div>
            )}
          </div>
          <div className="mt-1.5 flex items-center justify-between px-0.5 text-[11px] text-muted-foreground">
            <span>{c.pageCount ? `${c.pageCount} sahifa` : 'Hujjat'}</span>
            {c.isFree && <span className="font-bold text-primary">Bepul</span>}
          </div>
        </button>
      ))}
    </div>
  );
}
