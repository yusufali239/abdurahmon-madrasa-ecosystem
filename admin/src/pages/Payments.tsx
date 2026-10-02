import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, FileImage, X } from 'lucide-react';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { cn, dateUz, PAYMENT_STATUS, som } from '@shared/lib/utils';
import { api } from '@/lib/api';
import { ErrorBox, PageTitle, Table } from '@/components/AdminLayout';

export default function PaymentsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('PENDING');
  const [type, setType] = useState('');
  const qs = new URLSearchParams({ ...(status && { status }), ...(type && { type }) });
  const payments = useQuery({ queryKey: ['payments', qs.toString()], queryFn: () => api<any[]>(`/admin/payments?${qs}`) });
  const act = useMutation({
    mutationFn: ({ id, ok }: { id: number; ok: boolean }) =>
      api(`/admin/payments/${id}/${ok ? 'confirm' : 'reject'}`, { method: 'POST', body: ok ? {} : { reason: prompt('Rad etish sababi (ixtiyoriy)') || undefined } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      qc.invalidateQueries({ queryKey: ['fund'] });
    },
  });
  const chip = (active: boolean) => cn('rounded-full border px-3.5 py-1.5 text-xs font-bold', active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground');

  return (
    <div>
      <PageTitle title="To'lovlar" subtitle="Chekni tekshiring → Tasdiqlash. Hayriya to'lovi tasdiqlanganda ustoz hissasiga qo'shiladi." />
      <div className="mb-4 flex flex-wrap gap-2">
        {['PENDING', 'CONFIRMED', 'REJECTED', ''].map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={chip(status === s)}>
            {s ? PAYMENT_STATUS[s].label : 'Barchasi'}
          </button>
        ))}
        <span className="mx-1 w-px bg-border" />
        {[
          ['', 'Barcha turlar'],
          ['MBANK_SELF', 'MBank (ustozga)'],
          ['HAYRIYA', 'Hayriya'],
        ].map(([k, v]) => (
          <button key={k} onClick={() => setType(k)} className={chip(type === k)}>
            {v}
          </button>
        ))}
      </div>
      <ErrorBox error={act.error} />
      <Table head={['#', 'Talaba', 'Dars / Ustoz', 'Summa', 'Turi', 'Chek', 'Holat', '']} empty={payments.data?.length === 0}>
        {payments.data?.map((p) => (
          <tr key={p.id}>
            <td className="text-xs text-muted-foreground">{p.id}</td>
            <td>
              <p className="font-bold">{p.student.fullName}</p>
              <p className="text-xs text-muted-foreground">{p.student.phone}</p>
            </td>
            <td>
              <p>{p.lesson ? p.lesson.subject.name : 'Hayriya xayriyasi'}</p>
              <p className="text-xs text-muted-foreground">
                {p.teacher.user.fullName} · {p.period} · {dateUz(p.createdAt)}
              </p>
            </td>
            <td className="font-extrabold">{som(p.amount)}</td>
            <td>
              <Badge variant={p.paymentType === 'HAYRIYA' ? 'gold' : 'outline'}>{p.paymentType === 'HAYRIYA' ? 'Hayriya' : 'MBank'}</Badge>
            </td>
            <td>
              {p.receipt_url ? (
                <a href={p.receipt_url} target="_blank" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                  <FileImage className="size-4" /> Ko'rish
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </td>
            <td>
              <Badge variant={p.status === 'CONFIRMED' ? 'default' : p.status === 'REJECTED' ? 'red' : 'gold'}>{PAYMENT_STATUS[p.status].label}</Badge>
            </td>
            <td>
              {p.status === 'PENDING' && (
                <div className="flex gap-1.5">
                  <Button size="sm" onClick={() => act.mutate({ id: p.id, ok: true })}>
                    <Check /> Tasdiqlash
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => act.mutate({ id: p.id, ok: false })}>
                    <X />
                  </Button>
                </div>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
