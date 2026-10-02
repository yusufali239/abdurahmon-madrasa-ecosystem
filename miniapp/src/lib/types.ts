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
  weekDay: number;
  startTime: string;
  endTime: string;
  startClock: string | null;
  bookTitle: string;
  bookTotalPages: number;
  currentPageFrom: number;
  currentPageTo: number;
  topic: string;
  nextTopic: string | null;
  priceTier: number;
  customPrice: number | null;
  paymentType: PaymentType;
  isActive: boolean;
  subject: Subject;
  location: Location | null;
  teacher: { id: number; mbankNumber: string; telegramPhone: string; user: { id: number; fullName: string | null; username?: string | null } };
  _count?: { enrollments: number; contents: number };
  price: number;
  approxStart: string | null;
  progressPercent: number;
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
  paymentType: PaymentType;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  receipt_url: string | null;
  period: string | null;
  createdAt: string;
  lessonId: number | null;
  student?: { id: number; fullName: string | null; phone: string | null };
  teacher?: { user: { fullName: string | null } };
  lesson?: { subject: Subject } | null;
}

export interface LessonDetail extends Lesson {
  hasAccess: boolean;
  enrolled: boolean;
  paidThisPeriod: boolean;
  pendingPayment: Payment | null;
  period: string;
  payments: Payment[];
  attendances: Array<{ id: number; status: string; session: { date: string; pageFrom: number; pageTo: number; topic: string } }>;
  grades: Array<{ id: number; score: number; comment: string | null; createdAt: string }>;
  sessions: Array<{ id: number; date: string; status: string; pageFrom: number; pageTo: number; topic: string; cancelReason: string | null }>;
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
