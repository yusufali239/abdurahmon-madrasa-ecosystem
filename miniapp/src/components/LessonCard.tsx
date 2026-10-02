import { CheckCircle2, Clock3, HandHeart, Infinity as InfinityIcon, MapPin, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@shared/ui/badge';
import { WEEKDAYS, som } from '@shared/lib/utils';
import type { Lesson } from '@/lib/types';
import { BookProgress, SubjectIcon } from './common';

export function PriceBadge({ lesson }: { lesson: Pick<Lesson, 'price' | 'customPrice'> }) {
  if (!lesson.price) return <Badge variant="default">Bepul</Badge>;
  return (
    <Badge variant="gold">
      {som(lesson.price)}/oy{lesson.customPrice ? ' · Shaxsiy' : ''}
    </Badge>
  );
}

export function PaymentTypeBadge({ type }: { type: Lesson['paymentType'] }) {
  return type === 'HAYRIYA' ? (
    <Badge variant="outline">
      <HandHeart /> Hayriya
    </Badge>
  ) : (
    <Badge variant="outline">
      <Wallet /> MBank
    </Badge>
  );
}

export function LessonCard({ lesson, to }: { lesson: Lesson; to?: string }) {
  return (
    <Link
      to={to ?? `/lessons/${lesson.id}`}
      className="block animate-fade-up rounded-2xl border bg-card p-4 shadow-soft transition active:scale-[.99]"
    >
      <div className="flex gap-3">
        <SubjectIcon icon={lesson.subject.icon} color={lesson.subject.color} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-extrabold leading-tight">{lesson.subject.name}</h3>
              <p className="truncate text-sm text-muted-foreground">{lesson.teacher.user.fullName}</p>
            </div>
            {lesson.enrolled && <CheckCircle2 className="size-5 shrink-0 text-primary" aria-label="Yozilgansiz" />}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-semibold text-foreground">
              <Clock3 className="size-3.5 text-gold" />
              {WEEKDAYS[lesson.weekDay]}, {lesson.startTime}
              {lesson.approxStart && !/\d:\d/.test(lesson.startTime) && <span className="font-normal text-muted-foreground">(~{lesson.approxStart})</span>}
            </span>
            <span>{lesson.endTime}</span>
            {lesson.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {lesson.location.title}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 rounded-xl bg-muted/60 p-3">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-bold">
            <span className="text-gold-foreground dark:text-gold">{lesson.currentPageFrom}-bet</span> · {lesson.topic}
          </p>
          <span className="shrink-0 text-[11px] text-muted-foreground">{lesson.bookTotalPages} bet</span>
        </div>
        <BookProgress from={lesson.currentPageFrom} to={lesson.currentPageTo} total={lesson.bookTotalPages} compact />
        <p className="mt-1.5 truncate text-[11px] text-muted-foreground">📖 {lesson.bookTitle}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {lesson.isContinuous && (
          <Badge variant="default">
            <InfinityIcon /> Davomiy
          </Badge>
        )}
        <PriceBadge lesson={lesson} />
        <PaymentTypeBadge type={lesson.paymentType} />
        {!lesson.isActive && <Badge variant="red">Faol emas</Badge>}
      </div>
    </Link>
  );
}
