import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Ban, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Input, Select } from '@shared/ui/input';
import { cn, dateUz } from '@shared/lib/utils';
import { api } from '@/lib/api';
import { ErrorBox, PageTitle, Table } from '@/components/AdminLayout';

const STATUS: Record<string, { label: string; v: any }> = {
  PENDING: { label: 'Kutilmoqda', v: 'gold' },
  APPROVED: { label: 'Tasdiqlangan', v: 'default' },
  REJECTED: { label: 'Rad etilgan', v: 'red' },
  BLOCKED: { label: 'Bloklangan', v: 'red' },
};
const ROLE: Record<string, string> = { STUDENT: 'Talaba', TEACHER: 'Ustoz', ADMIN: 'Admin' };

export default function UsersPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const qs = new URLSearchParams({ ...(status && { status }), ...(role && { role }), ...(q && { q }) });
  const users = useQuery({ queryKey: ['users', qs.toString()], queryFn: () => api<any[]>(`/admin/users?${qs}`) });
  const act = useMutation({
    mutationFn: ({ id, action, body }: { id: number; action: string; body?: any }) =>
      action === 'role' ? api(`/admin/users/${id}`, { method: 'PATCH', body }) : api(`/admin/users/${id}/${action}`, { method: 'POST', body: body ?? {} }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  return (
    <div>
      <PageTitle title="Foydalanuvchilar" subtitle="Arizalarni tasdiqlash, rollar va bloklash" />
      <div className="mb-4 flex flex-wrap gap-2">
        {['', 'PENDING', 'APPROVED', 'REJECTED', 'BLOCKED'].map((s) => (
          <button
            key={s}
            onClick={() => setParams(s ? { status: s } : {})}
            className={cn('rounded-full border px-3.5 py-1.5 text-xs font-bold', status === s ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground')}
          >
            {s ? STATUS[s].label : 'Barchasi'}
          </button>
        ))}
        <Select className="h-9 w-40 text-xs" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Barcha rollar</option>
          <option value="STUDENT">Talaba</option>
          <option value="TEACHER">Ustoz</option>
          <option value="ADMIN">Admin</option>
        </Select>
        <Input className="h-9 w-56 text-xs" placeholder="Ism, telefon, pasport…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ErrorBox error={act.error} />
      <Table head={['Foydalanuvchi', 'Pasport', 'Rol', 'Holat', 'Sana', 'Amallar']} empty={users.data?.length === 0}>
        {users.data?.map((u) => (
          <tr key={u.id}>
            <td>
              <p className="font-bold">{u.fullName || '—'}</p>
              <p className="text-xs text-muted-foreground">
                {u.phone || '—'} {u.username && `· @${u.username}`}
              </p>
              {u.regStep !== 'DONE' && <p className="text-[11px] text-gold-foreground">Ro'yxatdan o'tmoqda: {u.regStep}</p>}
            </td>
            <td className="font-mono text-xs">{u.passportId || '—'}</td>
            <td>
              <Select className="h-8 w-28 text-xs" value={u.role} onChange={(e) => act.mutate({ id: u.id, action: 'role', body: { role: e.target.value } })}>
                {Object.entries(ROLE).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </td>
            <td>
              <Badge variant={STATUS[u.status].v}>{STATUS[u.status].label}</Badge>
            </td>
            <td className="text-xs text-muted-foreground">{dateUz(u.createdAt, true)}</td>
            <td>
              <div className="flex gap-1.5">
                {u.status !== 'APPROVED' && u.regStep === 'DONE' && (
                  <Button size="sm" onClick={() => act.mutate({ id: u.id, action: 'approve', body: { role: u.role } })}>
                    <Check /> Tasdiqlash
                  </Button>
                )}
                {u.status === 'PENDING' && u.regStep === 'DONE' && (
                  <Button size="sm" variant="outline" onClick={() => act.mutate({ id: u.id, action: 'reject' })}>
                    <X /> Rad
                  </Button>
                )}
                {u.status === 'APPROVED' && (
                  <Button size="sm" variant="ghost" onClick={() => confirm('Bloklansinmi?') && act.mutate({ id: u.id, action: 'block' })}>
                    <Ban />
                  </Button>
                )}
                {u.status === 'BLOCKED' && (
                  <Button size="sm" variant="outline" onClick={() => act.mutate({ id: u.id, action: 'unblock' })}>
                    Blokdan chiqarish
                  </Button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
