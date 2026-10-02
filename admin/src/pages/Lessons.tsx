import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HandHeart, Infinity as InfinityIcon, Pencil, Plus, Wallet } from 'lucide-react';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Dialog, DialogContent } from '@shared/ui/dialog';
import { Field, Select } from '@shared/ui/input';
import { EMPTY_LESSON, LessonForm, lessonPayload, lessonToForm, type LessonFormValue } from '@shared/ui/lesson-form';
import { Progress } from '@shared/ui/progress';
import { dateUz, som, WEEKDAYS } from '@shared/lib/utils';
import { api } from '@/lib/api';
import { ErrorBox, PageTitle } from '@/components/AdminLayout';

const ATT: Record<string, string> = { PRESENT: '✅', ABSENT: '❌', LATE: '⏰', EXCUSED: '📝' };

function LessonDialog({ lesson, open, onOpenChange }: { lesson: any | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const teachers = useQuery({ queryKey: ['teachers'], queryFn: () => api<any[]>('/admin/teachers') });
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: () => api<any[]>('/admin/subjects') });
  const detail = useQuery({ queryKey: ['admin-lesson', lesson?.id], queryFn: () => api<any>(`/admin/lessons/${lesson.id}`), enabled: !!lesson?.id && open });
  const [teacherId, setTeacherId] = useState<string>('');
  const [form, setForm] = useState<LessonFormValue>(EMPTY_LESSON);
  useEffect(() => {
    if (lesson) {
      setForm(lessonToForm(lesson));
      setTeacherId(String(lesson.teacherId));
    } else {
      setForm(EMPTY_LESSON);
      setTeacherId('');
    }
  }, [lesson, open]);
  const teacher = teachers.data?.find((t) => String(t.id) === teacherId);
  const save = useMutation({
    mutationFn: () =>
      lesson
        ? api(`/admin/lessons/${lesson.id}`, { method: 'PATCH', body: lessonPayload(form) })
        : api('/admin/lessons', { body: { ...lessonPayload(form), teacherId: Number(teacherId) } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-lessons'] });
      onOpenChange(false);
    },
  });
  const d = detail.data;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" title={lesson ? `${lesson.subject.name} — ${lesson.teacher.user.fullName}` : 'Yangi dars'}>
        <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
          <div>
            {!lesson && (
              <Field label="Ustoz" className="mb-4">
                <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                  <option value="">Tanlang…</option>
                  {teachers.data?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.user.fullName}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <LessonForm value={form} onChange={setForm} subjects={subjects.data ?? []} locations={(lesson ? lesson.teacher.locations : teacher?.locations) ?? d?.teacher?.locations ?? []} />
            <div className="mt-3">
              <ErrorBox error={save.error} />
            </div>
            <Button size="lg" className="mt-4 w-full" loading={save.isPending} disabled={!lesson && !teacherId} onClick={() => save.mutate()}>
              Saqlash
            </Button>
          </div>
          {d && (
            <div className="space-y-4 text-sm">
              <div>
                <p className="mb-1.5 font-bold">Talabalar ({d.students.length})</p>
                {d.students.map((s: any) => (
                  <p key={s.id} className="text-muted-foreground">
                    {s.fullName} · {s.phone}
                  </p>
                ))}
              </div>
              <div>
                <p className="mb-1.5 font-bold">Mashg'ulotlar va davomat</p>
                {d.sessions.map((s: any) => (
                  <div key={s.id} className="mb-2 rounded-xl bg-muted/60 p-2.5">
                    <p className="font-semibold">
                      {dateUz(s.date)} · {s.status} · {s.pageFrom}–{s.pageTo}
                    </p>
                    {s.cancelReason && <p className="text-xs text-destructive">Sabab: {s.cancelReason}</p>}
                    <p className="text-xs">{s.attendances.map((a: any) => `${ATT[a.status]} ${a.student.fullName}`).join(', ')}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="mb-1.5 font-bold">Baholar</p>
                {d.grades.map((g: any) => (
                  <p key={g.id} className="text-muted-foreground">
                    {g.student.fullName}: <b className="text-foreground">{g.score}</b> {g.comment && `— ${g.comment}`}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function LessonsPage() {
  const lessons = useQuery({ queryKey: ['admin-lessons'], queryFn: () => api<any[]>('/admin/lessons') });
  const teachers = useQuery({ queryKey: ['teachers'], queryFn: () => api<any[]>('/admin/teachers') });
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const withLocations = (l: any) => ({ ...l, teacher: { ...l.teacher, locations: teachers.data?.find((t) => t.id === l.teacherId)?.locations ?? [] } });

  return (
    <div>
      <PageTitle
        title="Darslar"
        subtitle="Davomiy darslar, kitob progressi, narx va to'lov turi"
        action={
          <Button onClick={() => (setSelected(null), setOpen(true))}>
            <Plus /> Yangi dars
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {lessons.data?.map((l) => (
          <div key={l.id} className={`rounded-2xl border bg-card p-5 shadow-soft ${l.isActive ? '' : 'opacity-60'}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-extrabold" style={{ color: l.subject.color }}>
                  {l.subject.name}
                </p>
                <p className="text-sm font-semibold">{l.teacher.user.fullName}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => (setSelected(withLocations(l)), setOpen(true))} aria-label="Tahrirlash">
                <Pencil />
              </Button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {WEEKDAYS[l.weekDay]}, {l.startTime} {l.approxStart && !/\d:\d/.test(l.startTime) && `(~${l.approxStart})`} — {l.endTime}
            </p>
            <p className="mt-3 text-sm font-bold">
              {l.currentPageFrom}–{l.currentPageTo}-bet · {l.topic}
            </p>
            <p className="text-xs text-muted-foreground">
              «{l.bookTitle}» · {l.bookTotalPages} bet
            </p>
            <Progress className="mt-2" value={l.progressPercent} />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {l.isContinuous && (
                <Badge>
                  <InfinityIcon /> Davomiy
                </Badge>
              )}
              <Badge variant="gold">{l.price ? `${som(l.price)}${l.customPrice ? ' · Shaxsiy' : ''}` : 'Bepul'}</Badge>
              <Badge variant="outline">{l.paymentType === 'HAYRIYA' ? <><HandHeart /> Hayriya</> : <><Wallet /> MBank</>}</Badge>
              <Badge variant="muted">{l._count.enrollments} talaba</Badge>
              {!l.isActive && <Badge variant="red">Faol emas</Badge>}
            </div>
          </div>
        ))}
      </div>
      <LessonDialog lesson={selected} open={open} onOpenChange={setOpen} />
    </div>
  );
}
