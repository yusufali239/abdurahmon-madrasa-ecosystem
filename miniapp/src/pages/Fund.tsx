import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HandHeart, PlayCircle, Target, TrendingUp } from 'lucide-react';
import { Button } from '@shared/ui/button';
import { Dialog, DialogContent } from '@shared/ui/dialog';
import { Progress } from '@shared/ui/progress';
import { dateUz, som } from '@shared/lib/utils';
import { api } from '@/lib/api';
import { useMe } from '@/lib/me';
import type { DonationReport, FundSummary } from '@/lib/types';
import { DonateSheet } from '@/components/DonateSheet';
import { EmptyState, ErrorBox, ListSkeleton, PageHeader, SectionTitle } from '@/components/common';
import { VideoPlayer } from '@/components/VideoPlayer';

export default function FundPage() {
  const me = useMe();
  const [donateOpen, setDonateOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const fund = useQuery({ queryKey: ['fund'], queryFn: () => api<FundSummary>('/fund') });
  const reports = useQuery({ queryKey: ['fund-reports'], queryFn: () => api<DonationReport[]>('/fund/reports') });

  if (fund.isLoading) return <div className="pt-4"><ListSkeleton rows={3} /></div>;
  if (fund.error) return <ErrorBox error={fund.error} />;
  const f = fund.data!;

  return (
    <div>
      <PageHeader title="Hayriya jamg'armasi" subtitle="Madrasa xayriya fondi" />

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#7a5a22] via-[#C4A15A] to-[#E2C98D] p-5 text-[#2b1f08]">
        <div className="ornament absolute inset-0 opacity-80" />
        <div className="relative">
          <p className="font-arabic text-lg">مَنْ ذَا الَّذِي يُقْرِضُ اللَّهَ قَرْضًا حَسَنًا</p>
          {me.role === 'TEACHER' && f.personalTotal !== null && (
            <div className="mt-3 rounded-2xl bg-white/35 p-3.5 ring-1 ring-white/40 backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-wide opacity-75">Hayriya jamg'armasi: Sizning hissangiz</p>
              <p className="text-3xl font-semibold tracking-tight">{som(f.personalTotal)}</p>
            </div>
          )}
          <div className="mt-3">
            <p className="text-xs font-bold uppercase tracking-wide opacity-75">Umumiy jamg'arma</p>
            <p className="text-4xl font-semibold tracking-tight">{som(f.globalTotal)}</p>
          </div>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-card p-3.5">
          <TrendingUp className="mb-1.5 size-5 text-primary" />
          <p className="text-xs text-muted-foreground">Tarqatildi</p>
          <p className="text-lg font-semibold">{som(f.distributed)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-3.5">
          <Target className="mb-1.5 size-5 text-gold" />
          <p className="text-xs text-muted-foreground">Qoldiq / limit</p>
          <p className="text-lg font-semibold">
            {som(f.available)}
            <span className="block text-xs font-semibold text-muted-foreground">limit: {som(f.limit)}</span>
          </p>
        </div>
      </div>
      <div className="mt-3 rounded-2xl border bg-card p-4">
        <div className="mb-2 flex justify-between text-xs font-bold">
          <span>Tarqatishgacha</span>
          <span className="text-gold">{f.progressPercent}%</span>
        </div>
        <Progress value={f.progressPercent} className="h-3" indicatorClassName="from-gold to-[#E2C98D]" />
        <p className="mt-2 text-xs text-muted-foreground">
          {f.limitReached ? 'Limitga yetildi — admin mablag\'ni muhtojlarga tarqatadi va video-hisobot joylaydi.' : `Limitgacha ${som(Math.max(0, f.limit - f.available))} qoldi.`}
        </p>
      </div>

      <div className="mt-4 grid gap-2.5">
        <Button size="lg" variant="gold" onClick={() => setDonateOpen(true)}>
          <HandHeart /> Hayriya qilish
        </Button>
        <Button size="lg" variant="outline" onClick={() => setReportsOpen(true)}>
          <PlayCircle /> Hisobotlarni ko'rish
        </Button>
      </div>

      <SectionTitle>So'nggi hisobotlar</SectionTitle>
      {reports.data && !reports.data.length && <EmptyState title="Hozircha hisobot yo'q" />}
      <div className="space-y-3">
        {reports.data?.slice(0, 2).map((r) => (
          <div key={r.id} className="rounded-2xl border bg-card p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{som(r.spentAmount)}</p>
              <span className="text-xs text-muted-foreground">{dateUz(r.createdAt, true)}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{r.description.replace(/^\[Demo\]\s*/, '')}</p>
          </div>
        ))}
      </div>

      <DonateSheet open={donateOpen} onOpenChange={setDonateOpen} fund={f} />
      <Dialog open={reportsOpen} onOpenChange={setReportsOpen}>
        <DialogContent side="bottom" title="Hayriya hisobotlari" description="Jamg'arma mablag'lari qanday sarflangani">
          <div className="space-y-4">
            {reports.data?.map((r) => (
              <div key={r.id}>
                <VideoPlayer url={r.video_url} />
                <div className="mt-2 flex items-center justify-between px-1">
                  <p className="text-sm font-semibold">Sarflandi: {som(r.spentAmount)}</p>
                  <span className="text-xs text-muted-foreground">{dateUz(r.createdAt, true)}</span>
                </div>
                <p className="px-1 text-sm text-muted-foreground">{r.description.replace(/^\[Demo\]\s*/, '')}</p>
              </div>
            ))}
            {reports.data && !reports.data.length && <EmptyState title="Hisobotlar yo'q" />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
