import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@shared/ui/button';
import { Dialog, DialogContent } from '@shared/ui/dialog';
import { Field, Input, Select } from '@shared/ui/input';
import { cn, som } from '@shared/lib/utils';
import { api } from '@/lib/api';
import { haptic } from '@/lib/telegram';
import type { FundSummary } from '@/lib/types';
import { MbankCard, ReceiptInput } from './MbankCard';
import { ErrorBox } from './common';

const AMOUNTS = [50, 100, 200, 500, 1000];

/** Пожертвование в фонд Hayriya от имени выбранного учителя */
export function DonateSheet({ open, onOpenChange, fund }: { open: boolean; onOpenChange: (v: boolean) => void; fund: FundSummary }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(100);
  const [teacherId, setTeacherId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const teachers = useQuery({
    queryKey: ['teachers'],
    queryFn: () => api<Array<{ id: number; user: { fullName: string } }>>('/teachers'),
    enabled: open,
  });
  const donate = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append('teacherId', teacherId || String(teachers.data?.[0]?.id ?? ''));
      form.append('amount', String(amount));
      if (file) form.append('receipt', file);
      return api('/donations', { form });
    },
    onSuccess: () => {
      haptic('success');
      qc.invalidateQueries({ queryKey: ['fund'] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => (onOpenChange(v), !v && (setFile(null), donate.reset()))}>
      <DialogContent side="bottom" title="Hayriya qilish" description="Sadaqa — eng yaxshi amallardan. Alloh qabul qilsin!">
        {donate.isSuccess ? (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle2 className="mb-3 size-14 text-primary" />
            <p className="text-lg font-semibold">Jazakallohu xoyron!</p>
            <p className="mt-1 text-sm text-muted-foreground">Admin chekni tasdiqlagach, summa jamg'armaga qo'shiladi.</p>
            <Button className="mt-6 w-full" onClick={() => onOpenChange(false)}>
              Yopish
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Qaysi ustoz hissasiga">
              <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                {teachers.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.user.fullName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Summa">
              <div className="mb-2 flex flex-wrap gap-2">
                {AMOUNTS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAmount(a)}
                    className={cn(
                      'rounded-xl border px-3.5 py-2 text-sm font-bold transition',
                      amount === a ? 'border-primary bg-primary text-primary-foreground' : 'bg-card',
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <Input type="number" inputMode="numeric" min={10} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </Field>
            <MbankCard number={fund.hayriyaMbankNumber} amount={amount} />
            <ReceiptInput file={file} onChange={setFile} />
            {donate.error && <ErrorBox error={donate.error} />}
            <Button size="lg" variant="gold" className="w-full" disabled={!file || amount < 10} loading={donate.isPending} onClick={() => donate.mutate()}>
              Hayriya qildim — {som(amount)}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
