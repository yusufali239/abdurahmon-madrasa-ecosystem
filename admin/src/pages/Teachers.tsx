import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@shared/ui/button';
import { Dialog, DialogContent } from '@shared/ui/dialog';
import { Field, Input, Textarea } from '@shared/ui/input';
import { cn, MAP_PROVIDERS, som } from '@shared/lib/utils';
import { api } from '@/lib/api';
import { ErrorBox, PageTitle } from '@/components/AdminLayout';

export default function TeachersPage() {
  const qc = useQueryClient();
  const teachers = useQuery({ queryKey: ['teachers'], queryFn: () => api<any[]>('/admin/teachers') });
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: () => api<any[]>('/admin/subjects') });
  const [edit, setEdit] = useState<any | null>(null);
  const [loc, setLoc] = useState({ title: '', address: '', map_url: '' });
  const refresh = () => qc.invalidateQueries({ queryKey: ['teachers'] });
  const save = useMutation({
    mutationFn: () =>
      api(`/admin/teachers/${edit.id}`, {
        method: 'PATCH',
        body: { telegramPhone: edit.telegramPhone, mbankNumber: edit.mbankNumber, bio: edit.bio, subjectIds: edit.subjectIds },
      }),
    onSuccess: () => (refresh(), setEdit(null)),
  });
  const addLoc = useMutation({
    mutationFn: (teacherId: number) => api(`/admin/teachers/${teacherId}/locations`, { body: loc }),
    onSuccess: () => (refresh(), setLoc({ title: '', address: '', map_url: '' })),
  });
  const delTeacher = useMutation({ mutationFn: (userId: number) => api(`/admin/users/${userId}`, { method: 'DELETE' }), onSuccess: refresh });
  const delLoc = useMutation({ mutationFn: (id: number) => api(`/admin/locations/${id}`, { method: 'DELETE' }), onSuccess: refresh });

  return (
    <div>
      <PageTitle title="Ustozlar" subtitle="Telegram va MBank raqamlari, fanlar, manzillar. Yangi ustoz — foydalanuvchi rolini «Ustoz» qiling." />
      <div className="grid gap-4 md:grid-cols-2">
        {teachers.data?.map((t) => (
          <div key={t.id} className="rounded-2xl border bg-card p-5 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-extrabold">{t.user.fullName}</p>
                <p className="text-xs text-muted-foreground">{t.subjects.map((s: any) => s.name).join(', ') || 'Fan biriktirilmagan'}</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setEdit({ ...t, subjectIds: t.subjects.map((s: any) => s.id) })}>
                  <Pencil /> Tahrirlash
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  title="O'chirish"
                  onClick={() => confirm(`${t.user.fullName} va uning barcha darslari o'chirilsinmi?`) && delTeacher.mutate(t.user.id)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-muted/60 p-3">
                <p className="text-xs text-muted-foreground">Telegram</p>
                <p className="font-bold">{t.telegramPhone || '—'}</p>
              </div>
              <div className="rounded-xl bg-muted/60 p-3">
                <p className="text-xs text-muted-foreground">MBank</p>
                <p className="font-bold">{t.mbankNumber || '—'}</p>
              </div>
              <div className="rounded-xl bg-gold-soft p-3">
                <p className="text-xs text-gold-foreground">Hayriya hissasi</p>
                <p className="font-bold">{som(t.donationFund?.personalTotal ?? 0)}</p>
              </div>
              <div className="rounded-xl bg-muted/60 p-3">
                <p className="text-xs text-muted-foreground">Faol darslar</p>
                <p className="font-bold">{t._count.lessons}</p>
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              {t.locations.map((l: any) => (
                <div key={l.id} className="flex items-center gap-2 text-sm">
                  <MapPin className="size-4 text-primary" />
                  <a href={l.map_url} target="_blank" className="flex-1 truncate hover:underline">
                    {l.title} · <span className="text-muted-foreground">{MAP_PROVIDERS[l.provider]}</span>
                  </a>
                  <button onClick={() => delLoc.mutate(l.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent title={edit?.user.fullName} description="Ustoz ma'lumotlari">
          {edit && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Telegram raqami">
                  <Input value={edit.telegramPhone} onChange={(e) => setEdit({ ...edit, telegramPhone: e.target.value })} />
                </Field>
                <Field label="MBank raqami">
                  <Input value={edit.mbankNumber} onChange={(e) => setEdit({ ...edit, mbankNumber: e.target.value })} />
                </Field>
              </div>
              <Field label="Fanlar">
                <div className="flex flex-wrap gap-2">
                  {subjects.data?.map((s) => (
                    <button
                      key={s.id}
                      onClick={() =>
                        setEdit({ ...edit, subjectIds: edit.subjectIds.includes(s.id) ? edit.subjectIds.filter((x: number) => x !== s.id) : [...edit.subjectIds, s.id] })
                      }
                      className={cn('rounded-full border px-3 py-1.5 text-xs font-bold', edit.subjectIds.includes(s.id) ? 'border-primary bg-primary text-primary-foreground' : '')}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Bio">
                <Textarea value={edit.bio ?? ''} onChange={(e) => setEdit({ ...edit, bio: e.target.value })} />
              </Field>
              <ErrorBox error={save.error} />
              <Button className="w-full" loading={save.isPending} onClick={() => save.mutate()}>
                Saqlash
              </Button>
              <div className="border-t pt-3">
                <p className="mb-2 text-sm font-bold">Yangi manzil</p>
                <div className="grid gap-2">
                  <Input placeholder="Nomi" value={loc.title} onChange={(e) => setLoc({ ...loc, title: e.target.value })} />
                  <Input placeholder="Manzil" value={loc.address} onChange={(e) => setLoc({ ...loc, address: e.target.value })} />
                  <Input placeholder="2GIS / Yandex / Google havola" value={loc.map_url} onChange={(e) => setLoc({ ...loc, map_url: e.target.value })} />
                  <ErrorBox error={addLoc.error} />
                  <Button variant="secondary" loading={addLoc.isPending} onClick={() => addLoc.mutate(edit.id)}>
                    Manzil qo'shish
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
