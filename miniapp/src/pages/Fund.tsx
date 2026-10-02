import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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

const clean = (s: string) => s.replace(/^\[Demo\]\s*/, '');

export default function FundPage() {
  const me = useMe();
  const [donateOpen, setDonateOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const fund = useQuery({ queryKey: ['fund'], queryFn: () => api<FundSummary>('/fund') });
  const reports = useQuery({ queryKey: ['fund-reports'], queryFn: () => api<DonationReport[]>('/fund/reports') });
  const mine = useQuery({ queryKey: ['my-donations'], queryFn: () => api<{ total: number; count: number; pending: number }>('/donations/mine') });

  if (fund.isLoading) return <div className="pt-6"><ListSkeleton rows={3} /></div>;
  if (fund.error) return <ErrorBox error={fund.error} />;
  const f = fund.data!;

  return (
    <div>
      <PageHeader title="Hayriya" />

      <div className="rounded-2xl border bg-card p-5">
        <p className="text-sm text-muted-foreground">Umumiy jamg'arma</p>
        <p className="mt-1 text-3xl font-bold tracking-tight">{som(f.globalTotal)}</p>
        <Progress value={f.progressPercent} className="mt-5 h-1.5" />
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>Tarqatildi: {som(f.distributed)}</span>
          <span>Limit: {som(f.limit)}</span>
        </div>
      </div>

      <div className="mt-3 grid gap-3">
        {me.role === 'TEACHER' && f.personalTotal !== null && (
          <div className="flex items-baseline justify-between rounded-2xl border bg-card px-5 py-4">
            <span className="text-sm text-muted-foreground">Sizning hissangiz</span>
            <span className="font-semibold">{som(f.personalTotal)}</span>
          </div>
        )}
        <div className="flex items-baseline justify-between rounded-2xl border bg-card px-5 py-4">
          <span className="text-sm text-muted-foreground">Sizning xayriyalaringiz</span>
          <span className="font-semibold">
            {som(mine.data?.total ?? 0)}
            {!!mine.data?.pending && <span className="ml-1 text-xs font-normal text-muted-foreground">(+{som(mine.data.pending)})</span>}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-2.5">
        <Button size="lg" onClick={() => setDonateOpen(true)}>
          Xayriya qilish
        </Button>
        <Button size="lg" variant="outline" onClick={() => setReportsOpen(true)}>
          Hisobotlarni ko'rish
        </Button>
      </div>

      {!!reports.data?.length && (
        <>
          <SectionTitle>So'nggi hisobot</SectionTitle>
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">{som(reports.data[0].spentAmount)}</span>
              <span className="text-xs text-muted-foreground">{dateUz(reports.data[0].createdAt, true)}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{clean(reports.data[0].description)}</p>
          </div>
        </>
      )}

      <DonateSheet open={donateOpen} onOpenChange={setDonateOpen} fund={f} />
      <Dialog open={reportsOpen} onOpenChange={setReportsOpen}>
        <DialogContent side="bottom" title="Hisobotlar">
          <div className="space-y-6">
            {reports.data?.map((r) => (
              <div key={r.id}>
                <VideoPlayer url={r.video_url} />
                <div className="mt-3 flex items-baseline justify-between px-1">
                  <p className="font-semibold">{som(r.spentAmount)}</p>
                  <span className="text-xs text-muted-foreground">{dateUz(r.createdAt, true)}</span>
                </div>
                <p className="px-1 text-sm text-muted-foreground">{clean(r.description)}</p>
              </div>
            ))}
            {reports.data && !reports.data.length && <EmptyState title="Hisobotlar yo'q" />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
