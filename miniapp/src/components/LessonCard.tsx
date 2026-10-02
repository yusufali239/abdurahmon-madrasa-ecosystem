import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { daysText, pageTopic, som } from '@shared/lib/utils';
import type { Lesson } from '@/lib/types';
import { BookProgress, SubjectIcon } from './common';

export function priceText(price: number) {
  return price ? `${som(price)} / dars` : 'Bepul';
}

/** Карточка урока — минимально: предмет, учитель, дни и время, следующая тема, цена */
export function LessonCard({ lesson, to }: { lesson: Lesson; to?: string }) {
  const next = pageTopic(lesson.currentPage, lesson.topic);
  return (
    <Link to={to ?? `/lessons/${lesson.id}`} className="block rounded-2xl border bg-card p-4 transition active:scale-[.99]">
      <div className="flex items-start gap-3.5">
        <SubjectIcon icon={lesson.subject.icon} color={lesson.subject.color} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="truncate text-[15px] font-semibold">{lesson.subject.name}</h3>
            <span className="shrink-0 text-sm font-medium text-muted-foreground">{priceText(lesson.price)}</span>
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {lesson.teacher.user.fullName} · {daysText(lesson.weekDays)} · {lesson.startTime}
          </p>
          {next && <p className="mt-2 truncate text-sm">{next}</p>}
        </div>
        {lesson.enrolled && <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-label="Yozilgansiz" />}
      </div>
      {lesson.pagesDone !== null && (
        <div className="mt-3 pl-[58px]">
          <BookProgress done={lesson.pagesDone} total={lesson.bookTotalPages} compact />
        </div>
      )}
    </Link>
  );
}
