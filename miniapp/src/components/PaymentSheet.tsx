import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, HandHeart, Info } from 'lucide-react';
import { Button } from '@shared/ui/button';
import { Dialog, DialogContent } from '@shared/ui/dialog';
import { cn, som } from '@shared/lib/utils';
import { api } from '@/lib/api';
import { haptic } from '@/lib/telegram';
import { MbankCard, ReceiptInput } from './MbankCard';
import { ErrorBox } from './common';

interface PaymentInfo {
  amount: number;
  priceTier: number;
  customPrice: number | null;
  paymentType: 'MBANK_SELF' | 'HAYRIYA';
  period: string;
  subject: string;
  teacherName: string;
  recipient: { name: string; mbankNumber: string };
  existing: { status: string } | null;
}

const TIERS = [50, 100, 200];

/** Оплата урока: MBank учителя или фонд Hayriya, QR, копирование, загрузка чека */
export function PaymentSheet({ lessonId, open, onOpenChange }: { lessonId: number; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const info = useQuery({ queryKey: ['payment-info', lessonId], queryFn: () => api<PaymentInfo>(`/payments/info?lessonId=${lessonId}`), enabled: open });
  const pay = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append('lessonId', String(lessonId));
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
  const d = info.data;
  const hayriya = d?.paymentType === 'HAYRIYA';

  return (
    <Dialog open={open} onOpenChange={(v) => (onOpenChange(v), !v && (setFile(null), pay.reset()))}>
      <DialogContent side="bottom" title="Dars uchun to'lov" description={d ? `${d.subject} · ${d.teacherName} · ${d.period}` : undefined}>
        {info.isLoading && <div className="h-60 animate-pulse rounded-3xl bg-muted" />}
        {info.error && <ErrorBox error={info.error} />}
        {d && pay.isSuccess && (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle2 className="mb-3 size-14 text-primary" />
            <p className="text-lg font-extrabold">Chek yuborildi!</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              To'lov holati: <b>tekshirilmoqda</b>. Tasdiqlangach, botda xabar olasiz va barcha materiallar ochiladi.
            </p>
            <Button className="mt-6 w-full" onClick={() => onOpenChange(false)}>
              Yaxshi
            </Button>
          </div>
        )}
        {d && !pay.isSuccess && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Oylik narx</p>
              <div className="grid grid-cols-4 gap-2">
                {TIERS.map((t) => (
                  <div
                    key={t}
                    className={cn(
                      'rounded-xl border py-2 text-center text-sm font-bold',
                      !d.customPrice && d.priceTier === t ? 'border-primary bg-primary text-primary-foreground shadow-soft' : 'text-muted-foreground opacity-60',
                    )}
                  >
                    {t}
                  </div>
                ))}
                <div
                  className={cn(
                    'rounded-xl border py-2 text-center text-xs font-bold leading-5',
                    d.customPrice ? 'border-gold bg-gold text-gold-foreground shadow-gold' : 'text-muted-foreground opacity-60',
                  )}
                >
                  {d.customPrice ? d.customPrice : 'Shaxsiy'}
                </div>
              </div>
            </div>

            {hayriya && (
              <div className="flex gap-2.5 rounded-2xl bg-gold-soft p-3 text-sm text-gold-foreground dark:text-gold">
                <HandHeart className="mt-0.5 size-5 shrink-0" />
                <p>
                  Bu dars <b>Hayriya jamg'armasi</b> orqali. To'lov madrasa jamg'armasiga tushadi va ustozning hissasiga qo'shiladi.
                </p>
              </div>
            )}

            <MbankCard number={d.recipient.mbankNumber} name={d.recipient.name} amount={d.amount} note={`${d.subject} ${d.period}`} />

            <ReceiptInput file={file} onChange={setFile} />

            {d.existing && (
              <div className="flex gap-2 rounded-xl bg-muted p-3 text-sm">
                <Info className="mt-0.5 size-4 shrink-0" />
                {d.existing.status === 'CONFIRMED' ? 'Bu oy uchun to\'lov tasdiqlangan.' : 'To\'lovingiz tekshirilmoqda.'}
              </div>
            )}
            {pay.error && <ErrorBox error={pay.error} />}
            <Button size="lg" className="w-full" disabled={!file || !!d.existing} loading={pay.isPending} onClick={() => pay.mutate()}>
              To'ladim — {som(d.amount)}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
