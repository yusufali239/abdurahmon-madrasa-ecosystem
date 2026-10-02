export type Role = 'STUDENT' | 'TEACHER' | 'ADMIN';
export type PaymentType = 'MBANK_SELF' | 'HAYRIYA';
export type ContentType = 'AUDIO' | 'VIDEO' | 'PDF';

export interface Me {
  id: number;
  telegramId: string;
  fullName: string | null;
  phone: string | null;
  passportId: string | null;
  role: Role;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'BLOCKED';
  regStep: string;
  isAdmin: boolean;
}

export interface Subject {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  _count?: { lessons: number; teachers: number };
}

export interface Location {
  id: number;
  title: string;
  address: string;
  map_url: string;
  lat?: number | null;
  lng?: number | null;
  provider: 'TWOGIS' | 'YANDEX' | 'GOOGLE';
}

export interface Lesson {
  id: number;
  teacherId: number;
  subjectId: number;
  locationId: number | null;
  isContinuous: boolean;
  weekDays: number[];
  startTime: string;
  endTime: string;
  startClock: string | null;
  bookTitle: string;
  bookTotalPages: number;
  isNewBook: boolean;
  /** Страница, с которой начнётся следующий урок (null — спросят при старте) */
  currentPage: number | null;
  topic: string | null;
  priceTier: number;
  customPrice: number | null;
  paymentType?: PaymentType;
  isActive: boolean;
  subject: Subject;
  location: Location | null;
  teacher: { id: number; user: { id: number; fullName: string | null; username?: string | null } };
  _count?: { enrollments: number; contents: number };
  /** Цена за один день урока */
  price: number;
  approxStart: string | null;
  pagesDone: number | null;
  progressPercent: number | null;
  enrolled?: boolean;
}

export interface ContentItem {
  id: number;
  type: ContentType;
  title: string;
  isFree: boolean;
  locked: boolean;
  url: string | null;
  durationSec?: number | null;
  pageCount?: number | null;
  createdAt: string;
}

export interface Payment {
  id: number;
  amount: number;
  paymentType?: PaymentType;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  receipt_url: string | null;
  /** День урока "YYYY-MM-DD" */
  period: string | null;
  createdAt: string;
  lessonId: number | null;
  student?: { id: number; fullName: string | null; phone: string | null };
  teacher?: { user: { fullName: string | null } };
  lesson?: { subject: Subject } | null;
}

export interface SessionInfo {
  id: number;
  date: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'STARTED' | 'CANCELLED' | 'DONE';
  pageFrom: number | null;
  pageTo: number | null;
  topic: string | null;
  cancelReason: string | null;
}

export interface LessonDetail extends Lesson {
  hasAccess: boolean;
  enrolled: boolean;
  nextDate: string | null;
  nextDates: Array<{ date: string; weekDay: number; label: string }>;
  paidNext: boolean;
  pendingNext: Payment | null;
  payments: Payment[];
  attendances: Array<{ id: number; status: string; session: { date: string; pageFrom: number | null; pageTo: number | null; topic: string | null } }>;
  grades: Array<{ id: number; score: number; comment: string | null; createdAt: string }>;
  sessions: SessionInfo[];
  contents: ContentItem[];
}

export interface News {
  id: number;
  title: string;
  body: string;
  image_url: string | null;
  type: 'TADBIR' | 'SPORT_FUTBOL' | 'ELON';
  createdAt: string;
}

export interface FundSummary {
  personalTotal: number | null;
  globalTotal: number;
  distributed: number;
  available: number;
  limit: number;
  progressPercent: number;
  limitReached: boolean;
  reportsCount: number;
  hayriyaMbankNumber: string;
  recipientName: string;
}

export interface DonationReport {
  id: number;
  video_url: string;
  description: string;
  spentAmount: number;
  createdAt: string;
}
