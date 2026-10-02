import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@shared/ui/button';
import { Dialog, DialogContent } from '@shared/ui/dialog';
import { Input } from '@shared/ui/input';
import { cn, som } from '@shared/lib/utils';
import { api } from '@/lib/api';
import { haptic } from '@/lib/telegram';
import type { FundSummary } from '@/lib/types';
import { MbankCard, ReceiptInput } from './MbankCard';
import { ErrorBox } from './common';

const AMOUNTS = [50, 100, 200, 500, 1000];

/** Анонимная хайрия в общий фонд: только сумма и чек */
export function DonateSheet({ open, onOpenChange, fund }: { open: boolean; onOpenChange: (v: boolean) => void; fund: FundSummary }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(100);
  const [file, setFile] = useState<File | null>(null);
  const donate = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append('amount', String(amount));
      if (file) form.append('receipt', file);
      return api('/donations', { form });
    },
    onSuccess: () => {
      haptic('success');
      qc.invalidateQueries({ queryKey: ['fund'] });
      qc.invalidateQueries({ queryKey: ['my-donations'] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => (onOpenChange(v), !v && (setFile(null), donate.reset()))}>
      <DialogContent side="bottom" title="Xayriya">
        {donate.isSuccess ? (
          <div className="flex flex-col items-center py-10 text-center">
            <CheckCircle2 className="mb-4 size-12 text-primary" />
            <p className="text-lg font-semibold">Jazakallohu xoyron!</p>
            <Button className="mt-8 w-full" onClick={() => onOpenChange(false)}>
              Yopish
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {AMOUNTS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAmount(a)}
                    className={cn('rounded-xl border px-4 py-2.5 text-sm transition', amount === a ? 'border-primary bg-primary text-primary-foreground' : 'bg-card')}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <Input type="number" inputMode="numeric" min={10} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
            <MbankCard number={fund.hayriyaMbankNumber} amount={amount} />
            <ReceiptInput file={file} onChange={setFile} />
            {donate.error && <ErrorBox error={donate.error} />}
            <Button size="lg" className="w-full" disabled={!file || amount < 10} loading={donate.isPending} onClick={() => donate.mutate()}>
              Yuborish · {som(amount)}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
