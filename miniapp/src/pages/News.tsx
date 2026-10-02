import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent } from '@shared/ui/dialog';
import { cn, dateUz, NEWS_TYPES } from '@shared/lib/utils';
import { api, absUrl } from '@/lib/api';
import type { News } from '@/lib/types';
import { EmptyState, ErrorBox, ListSkeleton, PageHeader } from '@/components/common';

const TYPE_STYLE: Record<string, string> = {
  TADBIR: 'from-[#0B5E46] to-[#0E7A5A]',
  SPORT_FUTBOL: 'from-[#1f5f7a] to-[#2F8F8F]',
  ELON: 'from-[#8A6A2F] to-[#C4A15A]',
};

export default function NewsPage() {
  const [type, setType] = useState<string>('');
  const [open, setOpen] = useState<News | null>(null);
  const q = useQuery({ queryKey: ['news', type], queryFn: () => api<News[]>(`/news${type ? `?type=${type}` : ''}`) });

  return (
    <div>
      <PageHeader title="Yangiliklar" subtitle="Tadbirlar, sport va e'lonlar" />
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        {[['', 'Barchasi'], ...Object.entries(NEWS_TYPES).map(([k, v]) => [k, `${v.emoji} ${v.label}`])].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setType(k)}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold',
              type === k ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {q.isLoading && <ListSkeleton />}
      {q.error && <ErrorBox error={q.error} />}
      {q.data && !q.data.length && <EmptyState title="Yangiliklar yo'q" />}
      <div className="space-y-4">
        {q.data?.map((n, i) => (
          <article
            key={n.id}
            onClick={() => setOpen(n)}
            className="animate-fade-up cursor-pointer overflow-hidden rounded-3xl border bg-card shadow-soft"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            {n.image_url ? (
              <img src={absUrl(n.image_url)} alt="" className="aspect-[16/9] w-full object-cover" loading="lazy" />
            ) : (
              <div className={cn('relative flex aspect-[16/7] items-end bg-gradient-to-br p-4', TYPE_STYLE[n.type])}>
                <div className="ornament absolute inset-0 opacity-70" />
                <span className="relative text-4xl">{NEWS_TYPES[n.type]?.emoji}</span>
              </div>
            )}
            <div className="p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gold">
                {NEWS_TYPES[n.type]?.label} · {dateUz(n.createdAt)}
              </p>
              <h2 className="mt-1 text-[17px] font-extrabold leading-snug">{n.title}</h2>
              <p className="mt-1.5 line-clamp-3 text-sm text-muted-foreground">{n.body}</p>
            </div>
          </article>
        ))}
      </div>
      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent side="bottom" title={open?.title} description={open ? `${NEWS_TYPES[open.type]?.label} · ${dateUz(open.createdAt, true)}` : ''}>
          {open?.image_url && <img src={absUrl(open.image_url)} alt="" className="mb-4 w-full rounded-2xl" />}
          <p className="whitespace-pre-line text-[15px] leading-relaxed">{open?.body}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
