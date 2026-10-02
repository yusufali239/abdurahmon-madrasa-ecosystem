import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { api } from '@/lib/api';
import { ErrorBox, PageTitle, Table } from '@/components/AdminLayout';

export default function SubjectsPage() {
  const qc = useQueryClient();
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: () => api<any[]>('/admin/subjects') });
  const [form, setForm] = useState({ name: '', description: '', color: '#0E7A5A' });
  const refresh = () => qc.invalidateQueries({ queryKey: ['subjects'] });
  const create = useMutation({ mutationFn: () => api('/admin/subjects', { body: form }), onSuccess: () => (refresh(), setForm({ name: '', description: '', color: '#0E7A5A' })) });
  const update = useMutation({ mutationFn: ({ id, body }: { id: number; body: any }) => api(`/admin/subjects/${id}`, { method: 'PATCH', body }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: number) => api(`/admin/subjects/${id}`, { method: 'DELETE' }), onSuccess: refresh });
  return (
    <div>
      <PageTitle title="Fanlar" subtitle="Fiqh, Aqida, Arab tili, Qur'on, Hadis…" />
      <div className="mb-4 flex flex-wrap gap-2 rounded-2xl border bg-card p-4 shadow-soft">
        <Input className="w-48" placeholder="Fan nomi" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input className="min-w-[200px] flex-1" placeholder="Tavsif" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <input type="color" className="h-11 w-14 rounded-xl border" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
        <Button loading={create.isPending} disabled={!form.name} onClick={() => create.mutate()}>
          Qo'shish
        </Button>
      </div>
      <ErrorBox error={create.error || remove.error} />
      <Table head={['Rang', 'Nomi', 'Tavsif', 'Darslar', '']}>
        {subjects.data?.map((s) => (
          <tr key={s.id}>
            <td>
              <input type="color" className="h-8 w-10 rounded-lg border" defaultValue={s.color || '#0E7A5A'} onBlur={(e) => update.mutate({ id: s.id, body: { color: e.target.value } })} />
            </td>
            <td className="font-bold">{s.name}</td>
            <td className="text-muted-foreground">{s.description}</td>
            <td>{s._count.lessons}</td>
            <td>
              <button onClick={() => confirm("O'chirilsinmi?") && remove.mutate(s.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="size-4" />
              </button>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
