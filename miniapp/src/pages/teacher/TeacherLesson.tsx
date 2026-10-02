import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { FileText, Headphones, Star, Trash2, Upload, Video } from 'lucide-react';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Field, Input, Select, Textarea } from '@shared/ui/input';
import { EMPTY_LESSON, LessonForm, lessonFormMissing, lessonPayload, lessonToForm, type LessonFormValue } from '@shared/ui/lesson-form';
import { Switch } from '@shared/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs';
import { cn, dateUz } from '@shared/lib/utils';
import { api } from '@/lib/api';
import { haptic } from '@/lib/telegram';
import type { LessonDetail, Location, Subject } from '@/lib/types';
import { BookProgress, ErrorBox, ListSkeleton, PageHeader } from '@/components/common';

const TYPE_ICON = { AUDIO: Headphones, VIDEO: Video, PDF: FileText };

function ContentTab({ lesson }: { lesson: LessonDetail }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'AUDIO' | 'VIDEO' | 'PDF'>('AUDIO');
  const [isFree, setIsFree] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['lesson', lesson.id] });
  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData();
      if (file) form.append('file', file);
      if (url) form.append('url', url);
      form.append('type', type);
      form.append('title', title || file?.name || '');
      form.append('isFree', String(isFree));
      return api(`/lessons/${lesson.id}/contents`, { form });
    },
    onSuccess: () => {
      haptic('success');
      setFile(null);
      setUrl('');
      setTitle('');
      refresh();
    },
  });
  const remove = useMutation({ mutationFn: (id: number) => api(`/contents/${id}`, { method: 'DELETE' }), onSuccess: refresh });
  const toggleFree = useMutation({
    mutationFn: ({ id, free }: { id: number; free: boolean }) => api(`/contents/${id}`, { method: 'PATCH', body: { isFree: free } }),
    onSuccess: refresh,
  });

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="grid grid-cols-3 gap-1.5">
          {(['AUDIO', 'VIDEO', 'PDF'] as const).map((t) => {
            const Icon = TYPE_ICON[t];
            return (
              <button
                key={t}
                onClick={() => setType(t)}
                className={cn('flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold', type === t ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground')}
              >
                <Icon className="size-4" /> {t === 'PDF' ? 'PDF' : t === 'AUDIO' ? 'Audio' : 'Video'}
              </button>
            );
          })}
        </div>
        <Field label="Sarlavha">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="56–72-bet: Halol va harom" />
        </Field>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed p-3">
          <Upload className="size-5 text-gold" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{file ? file.name : 'Fayl tanlash (mp3, mp4, pdf)'}</span>
          <input type="file" className="sr-only" accept="audio/*,video/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <Field label="yoki havola">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
        </Field>
        <Switch checked={isFree} onChange={setIsFree} label="Bepul (hamma ko'ra oladi)" />
        {upload.error && <ErrorBox error={upload.error} />}
        <Button className="w-full" disabled={!file && !url} loading={upload.isPending} onClick={() => upload.mutate()}>
          Yuklash
        </Button>
      </div>
      <div className="space-y-2">
        {lesson.contents.map((c) => {
          const Icon = TYPE_ICON[c.type];
          return (
            <div key={c.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{c.title}</p>
                <button onClick={() => toggleFree.mutate({ id: c.id, free: !c.isFree })}>
                  <Badge variant={c.isFree ? 'default' : 'gold'}>{c.isFree ? 'Bepul' : 'Pullik'}</Badge>
                </button>
              </div>
              <button onClick={() => remove.mutate(c.id)} className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="O'chirish">
                <Trash2 className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GradesTab({ lessonId }: { lessonId: number }) {
  const qc = useQueryClient();
  const students = useQuery({ queryKey: ['students', lessonId], queryFn: () => api<Array<{ id: number; fullName: string }>>(`/lessons/${lessonId}/students`) });
  const grades = useQuery({
    queryKey: ['grades', lessonId],
    queryFn: () => api<Array<{ id: number; score: number; comment: string | null; createdAt: string; student: { fullName: string } }>>(`/lessons/${lessonId}/grades`),
  });
  const [studentId, setStudentId] = useState('');
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState('');
  const add = useMutation({
    mutationFn: () => api(`/lessons/${lessonId}/grades`, { body: { studentId: Number(studentId), score, comment: comment || undefined } }),
    onSuccess: () => {
      haptic('success');
      setComment('');
      qc.invalidateQueries({ queryKey: ['grades', lessonId] });
    },
  });
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border bg-card p-4">
        <Field label="Talaba">
          <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Tanlang…</option>
            {students.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Baho">
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setScore(n)} className="p-1" aria-label={`${n}`}>
                <Star className={cn('size-8 transition', n <= score ? 'fill-gold text-gold' : 'text-muted')} />
              </button>
            ))}
          </div>
        </Field>
        <Field label="Izoh">
          <Textarea className="min-h-[70px]" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Yod olishi a'lo" />
        </Field>
        {add.error && <ErrorBox error={add.error} />}
        <Button className="w-full" disabled={!studentId} loading={add.isPending} onClick={() => add.mutate()}>
          Baho qo'yish (talabaga botda xabar boradi)
        </Button>
      </div>
      <div className="rounded-2xl border bg-card">
        {grades.data?.map((g) => (
          <div key={g.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-0">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/10 font-semibold text-primary">{g.score}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{g.student.fullName}</p>
              {g.comment && <p className="truncate text-xs text-muted-foreground">{g.comment}</p>}
            </div>
            <span className="text-xs text-muted-foreground">{dateUz(g.createdAt)}</span>
          </div>
        ))}
        {!grades.data?.length && <p className="p-4 text-sm text-muted-foreground">Baholar yo'q.</p>}
      </div>
    </div>
  );
}

export default function TeacherLessonPage() {
  const { id } = useParams();
  const isNew = id === 'new';
  const lessonId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<LessonFormValue>(EMPTY_LESSON);
  const [formError, setFormError] = useState<string | null>(null);
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: () => api<Subject[]>('/subjects') });
  const teacher = useQuery({ queryKey: ['teacher-me'], queryFn: () => api<{ locations: Location[] }>('/teachers/me') });
  const lesson = useQuery({ queryKey: ['lesson', lessonId], queryFn: () => api<LessonDetail>(`/lessons/${lessonId}`), enabled: !isNew });

  useEffect(() => {
    if (lesson.data) setForm(lessonToForm(lesson.data));
  }, [lesson.data]);

  const save = useMutation({
    mutationFn: () =>
      isNew ? api<{ id: number }>('/lessons', { body: lessonPayload(form) }) : api(`/lessons/${lessonId}`, { method: 'PATCH', body: lessonPayload(form) }),
    onSuccess: (res: any) => {
      haptic('success');
      qc.invalidateQueries({ queryKey: ['lessons'] });
      if (isNew) navigate(`/teacher/lessons/${res.id}`, { replace: true });
      else qc.invalidateQueries({ queryKey: ['lesson', lessonId] });
    },
    onError: () => haptic('error'),
  });
  const submit = () => {
    const missing = lessonFormMissing(form);
    setFormError(missing);
    if (!missing) save.mutate();
  };

  if (!isNew && lesson.isLoading) return <div className="pt-6"><ListSkeleton rows={3} /></div>;
  const l = lesson.data;
  const formNode = (
    <>
      <LessonForm value={form} onChange={setForm} subjects={subjects.data ?? []} locations={teacher.data?.locations ?? []} isEdit={!isNew} />
      {(formError || save.error) && <div className="mt-6">{formError ? <ErrorBox error={new Error(formError)} /> : <ErrorBox error={save.error} />}</div>}
      <Button size="lg" className="mt-8 w-full" loading={save.isPending} onClick={submit}>
        {isNew ? 'Darsni yaratish' : save.isSuccess ? 'Saqlandi ✓' : 'Saqlash'}
      </Button>
    </>
  );

  return (
    <div>
      <PageHeader title={isNew ? 'Yangi dars' : l?.subject.name ?? ''} subtitle={l?.bookTitle} back />
      {isNew ? (
        formNode
      ) : (
        <>
          {l && (
            <div className="mb-8">
              <BookProgress done={l.pagesDone} total={l.bookTotalPages} />
            </div>
          )}
          <Tabs defaultValue="info">
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="info">Sozlamalar</TabsTrigger>
              <TabsTrigger value="content">Materiallar</TabsTrigger>
              <TabsTrigger value="grades">Baholar</TabsTrigger>
            </TabsList>
            <TabsContent value="info" className="mt-6">
              {formNode}
            </TabsContent>
            <TabsContent value="content">{l && <ContentTab lesson={l} />}</TabsContent>
            <TabsContent value="grades">
              <GradesTab lessonId={lessonId} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
