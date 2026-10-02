import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Send, Trash2 } from 'lucide-react';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Field, Input, Textarea } from '@shared/ui/input';
import { Switch } from '@shared/ui/switch';
import { cn, dateUz, NEWS_TYPES } from '@shared/lib/utils';
import { absUrl, api, uploadFile } from '@/lib/api';
import { ErrorBox, PageTitle } from '@/components/AdminLayout';

export default function NewsPage() {
  const qc = useQueryClient();
  const news = useQuery({ queryKey: ['admin-news'], queryFn: () => api<any[]>('/admin/news') });
  const [form, setForm] = useState({ title: '', body: '', image_url: '', type: 'ELON', push: true });
  const [uploading, setUploading] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-news'] });
  const create = useMutation({
    mutationFn: () => api('/admin/news', { body: form }),
    onSuccess: () => (refresh(), setForm({ title: '', body: '', image_url: '', type: 'ELON', push: true })),
  });
  const push = useMutation({ mutationFn: (id: number) => api(`/admin/news/${id}/push`, { method: 'POST' }), onSuccess: () => setTimeout(refresh, 1500) });
  const del = useMutation({ mutationFn: (id: number) => api(`/admin/news/${id}`, { method: 'DELETE' }), onSuccess: refresh });

  return (
    <div>
      <PageTitle title="Yangiliklar" subtitle="Joylanganda barcha talaba va ustozlarga bot orqali push yuboriladi" />
      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <div className="h-fit space-y-3 rounded-2xl border bg-card p-5 shadow-soft">
          <Field label="Turi">
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(NEWS_TYPES).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => setForm({ ...form, type: k })}
                  className={cn('rounded-xl border px-2 py-2 text-xs font-bold', form.type === k ? 'border-primary bg-primary text-primary-foreground' : '')}
                >
                  {v.emoji} {v.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Sarlavha">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Matn">
            <Textarea className="min-h-[140px]" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </Field>
          <Field label="Rasm (ixtiyoriy)">
            <div className="flex gap-2">
              <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
              <label className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold hover:bg-muted">
                <ImagePlus className="size-4" /> {uploading ? '…' : ''}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setUploading(true);
                    try {
                      const r = await uploadFile(f, 'news');
                      setForm((x) => ({ ...x, image_url: r.url }));
                    } finally {
                      setUploading(false);
                    }
                  }}
                />
              </label>
            </div>
            {form.image_url && <img src={absUrl(form.image_url)} alt="" className="mt-2 rounded-xl" />}
          </Field>
          <Switch checked={form.push} onChange={(v) => setForm({ ...form, push: v })} label="Hammaga push yuborish" />
          <ErrorBox error={create.error} />
          <Button className="w-full" size="lg" loading={create.isPending} disabled={!form.title || !form.body} onClick={() => create.mutate()}>
            <Send /> Joylash
          </Button>
        </div>
        <div className="space-y-3">
          {news.data?.map((n) => (
            <div key={n.id} className="flex gap-4 rounded-2xl border bg-card p-4 shadow-soft">
              {n.image_url ? (
                <img src={n.image_url} alt="" className="size-20 shrink-0 rounded-xl object-cover" />
              ) : (
                <span className="grid size-20 shrink-0 place-items-center rounded-xl bg-muted text-3xl">{NEWS_TYPES[n.type]?.emoji}</span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="gold">{NEWS_TYPES[n.type]?.label}</Badge>
                  <span className="text-xs text-muted-foreground">{dateUz(n.createdAt, true)}</span>
                  {n.pushedAt ? <Badge>Push: {n.recipients} kishi</Badge> : <Badge variant="muted">Push yuborilmagan</Badge>}
                </div>
                <p className="mt-1 font-extrabold">{n.title}</p>
                <p className="line-clamp-2 text-sm text-muted-foreground">{n.body}</p>
              </div>
              <div className="flex flex-col gap-1">
                <Button size="icon" variant="ghost" title="Qayta push" onClick={() => push.mutate(n.id)}>
                  <Send />
                </Button>
                <Button size="icon" variant="ghost" title="O'chirish" onClick={() => confirm("O'chirilsinmi?") && del.mutate(n.id)}>
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
