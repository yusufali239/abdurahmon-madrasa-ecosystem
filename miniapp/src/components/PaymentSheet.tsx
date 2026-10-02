import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@shared/ui/button';
import { Dialog, DialogContent } from '@shared/ui/dialog';
import { cn, som } from '@shared/lib/utils';
import { api } from '@/lib/api';
import { haptic } from '@/lib/telegram';
import { MbankCard, ReceiptInput } from './MbankCard';
import { ErrorBox } from './common';

interface PaymentInfo {
  amount: number;
  subject: string;
  teacherName: string;
  dates: Array<{ date: string; label: string; status: 'PENDING' | 'CONFIRMED' | null }>;
  mbankNumber: string;
  mbankLink: string | null;
}

/** Оплата ОДНОГО дня урока: выбор дня, номер MBank, копирование, чек */
export function PaymentSheet({ lessonId, open, onOpenChange }: { lessonId: number; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [date, setDate] = useState<string>('');
  const info = useQuery({ queryKey: ['payment-info', lessonId], queryFn: () => api<PaymentInfo>(`/payments/info?lessonId=${lessonId}`), enabled: open });
  const d = info.data;
  useEffect(() => {
    if (d && !date) setDate(d.dates.find((x) => !x.status)?.date ?? '');
  }, [d, date]);
  const pay = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append('lessonId', String(lessonId));
      form.append('date', date);
      if (file) form.append('receipt', file);
      return api('/payments', { form });
    },
    onSuccess: () => {
      haptic('success');
      qc.invalidateQueries({ queryKey: ['lesson', lessonId] });
      qc.invalidateQueries({ queryKey: ['payment-info', lessonId] });
    },
    onError: () => haptic('error'),
  });
  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) {
      setFile(null);
      setDate('');
      pay.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent side="bottom" title="To'lov" description={d ? `${d.subject} · ${d.teacherName}` : undefined}>
        {info.isLoading && <div className="h-60 animate-pulse rounded-2xl bg-muted" />}
        {info.error && <ErrorBox error={info.error} />}
        {d && pay.isSuccess && (
          <div className="flex flex-col items-center py-10 text-center">
            <CheckCircle2 className="mb-4 size-12 text-primary" />
            <p className="text-lg font-semibold">Chek yuborildi</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">Tekshirilgach, botga xabar keladi.</p>
            <Button className="mt-8 w-full" onClick={() => close(false)}>
              Yaxshi
            </Button>
          </div>
        )}
        {d && !pay.isSuccess && (
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-sm text-muted-foreground">Qaysi dars uchun</p>
              <div className="grid grid-cols-2 gap-2">
                {d.dates.map((x) => (
                  <button
                    key={x.date}
                    disabled={!!x.status}
                    onClick={() => setDate(x.date)}
                    className={cn(
                      'rounded-xl border px-3 py-3 text-left text-sm transition disabled:opacity-50',
                      date === x.date ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-card',
                    )}
                  >
                    {/* «Bugun, Payshanba, 8-oktabr» -> дата крупно, день недели мелко */}
                    <span className="block font-medium">{x.label.split(', ').slice(-1)[0]}</span>
                    <span className="block text-xs text-muted-foreground">{x.label.split(', ').slice(0, -1).join(', ')}</span>
                    {x.status && <span className="text-xs text-primary">{x.status === 'CONFIRMED' ? "To'langan" : 'Tekshirilmoqda'}</span>}
                  </button>
                ))}
              </div>
            </div>

            <MbankCard number={d.mbankNumber} amount={d.amount} link={d.mbankLink} />

            <ReceiptInput file={file} onChange={setFile} />

            {pay.error && <ErrorBox error={pay.error} />}
            <Button size="lg" className="w-full" disabled={!file || !date} loading={pay.isPending} onClick={() => pay.mutate()}>
              To'ladim · {som(d.amount)}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
