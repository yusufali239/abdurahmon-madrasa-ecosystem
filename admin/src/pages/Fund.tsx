import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HandHeart, Target, Trash2, TrendingUp, Upload, Wallet } from 'lucide-react';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Field, Input, Textarea } from '@shared/ui/input';
import { Progress } from '@shared/ui/progress';
import { dateUz, som } from '@shared/lib/utils';
import { api, uploadFile } from '@/lib/api';
import { ErrorBox, PageTitle, Stat, Table } from '@/components/AdminLayout';

export default function FundPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['fund'], queryFn: () => api<any>('/admin/fund') });
  const [limit, setLimit] = useState('');
  const [report, setReport] = useState({ video_url: '', description: '', spentAmount: '' });
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    if (q.data) setLimit(String(q.data.summary.limit));
  }, [q.data]);
  const refresh = () => qc.invalidateQueries({ queryKey: ['fund'] });
  const saveLimit = useMutation({ mutationFn: () => api('/admin/fund/limit', { method: 'PUT', body: { limit: Number(limit) } }), onSuccess: refresh });
  const create = useMutation({
    mutationFn: () => api('/admin/fund/reports', { body: { ...report, spentAmount: Number(report.spentAmount) } }),
    onSuccess: () => (refresh(), setReport({ video_url: '', description: '', spentAmount: '' })),
  });
  const del = useMutation({ mutationFn: (id: number) => api(`/admin/fund/reports/${id}`, { method: 'DELETE' }), onSuccess: refresh });
  const s = q.data?.summary;

  return (
    <div>
      <PageTitle title="Hayriya jamg'armasi" subtitle="GlobalTotal = ustozlar hissalari yig'indisi. Limitga yetganda tarqating va video-hisobot yuklang." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Umumiy jamg'arma" value={s ? som(s.globalTotal) : '—'} icon={HandHeart} tone="gold" />
        <Stat label="Tarqatildi" value={s ? som(s.distributed) : '—'} icon={TrendingUp} />
        <Stat label="Qoldiq" value={s ? som(s.available) : '—'} icon={Wallet} />
        <Stat label="Kutilmoqda" value={s ? `${som(s.pendingAmount)} (${s.pendingCount})` : '—'} icon={Target} tone="gold" />
      </div>
      {s && (
        <div className="mt-4 rounded-2xl border bg-card p-5 shadow-soft">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-bold">
                Limit (DonationLimit): {som(s.limit)} {s.limitReached && <Badge variant="gold">Limitga yetdi — tarqatish vaqti!</Badge>}
              </p>
              <p className="text-xs text-muted-foreground">Hayriya MBank: {s.hayriyaMbankNumber}</p>
            </div>
            <div className="flex gap-2">
              <Input className="w-36" type="number" value={limit} onChange={(e) => setLimit(e.target.value)} />
              <Button variant="outline" loading={saveLimit.isPending} onClick={() => saveLimit.mutate()}>
                Saqlash
              </Button>
            </div>
          </div>
          <Progress className="mt-4 h-3" value={s.progressPercent} indicatorClassName="from-gold to-[#E2C98D]" />
          <p className="mt-1.5 text-xs text-muted-foreground">{s.progressPercent}%</p>
        </div>
      )}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-extrabold">Ustozlar hissasi</h2>
          <Table head={['Ustoz', 'Hissa (personalTotal)']}>
            {q.data?.teachers.map((t: any) => (
              <tr key={t.id}>
                <td className="font-bold">{t.teacher.user.fullName}</td>
                <td className="font-extrabold">{som(t.personalTotal)}</td>
              </tr>
            ))}
          </Table>
        </div>
        <div>
          <h2 className="mb-3 text-lg font-extrabold">Yangi hisobot (DonationReport)</h2>
          <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-soft">
            <Field label="Video" hint="Fayl yuklang yoki havola qo'ying (YouTube / mp4)">
              <div className="flex gap-2">
                <Input value={report.video_url} onChange={(e) => setReport({ ...report, video_url: e.target.value })} placeholder="https://..." />
                <label className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold hover:bg-muted">
                  <Upload className="size-4" /> {uploading ? '…' : 'Fayl'}
                  <input
                    type="file"
                    accept="video/*"
                    className="sr-only"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setUploading(true);
                      try {
                        const r = await uploadFile(f, 'reports');
                        setReport((x) => ({ ...x, video_url: r.url }));
                      } finally {
                        setUploading(false);
                      }
                    }}
                  />
                </label>
              </div>
            </Field>
            <Field label="Tavsif">
              <Textarea value={report.description} onChange={(e) => setReport({ ...report, description: e.target.value })} placeholder="12 ta muhtoj oilaga oziq-ovqat tarqatildi" />
            </Field>
            <Field label="Sarflangan summa (som)">
              <Input type="number" value={report.spentAmount} onChange={(e) => setReport({ ...report, spentAmount: e.target.value })} />
            </Field>
            <ErrorBox error={create.error} />
            <Button className="w-full" variant="gold" loading={create.isPending} onClick={() => create.mutate()}>
              Hisobotni joylash (ustozlarga xabar boradi)
            </Button>
          </div>
        </div>
      </div>
      <h2 className="mb-3 mt-8 text-lg font-extrabold">Hisobotlar</h2>
      <Table head={['Sana', 'Tavsif', 'Summa', 'Video', '']} empty={q.data?.reports.length === 0}>
        {q.data?.reports.map((r: any) => (
          <tr key={r.id}>
            <td className="text-xs">{dateUz(r.createdAt, true)}</td>
            <td>{r.description}</td>
            <td className="font-extrabold">{som(r.spentAmount)}</td>
            <td>
              <a href={r.video_url} target="_blank" className="text-xs font-bold text-primary hover:underline">
                Ko'rish
              </a>
            </td>
            <td>
              <button onClick={() => confirm("O'chirilsinmi?") && del.mutate(r.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="size-4" />
              </button>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
