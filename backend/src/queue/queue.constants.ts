export const NOTIFICATIONS_QUEUE = 'notifications';

export interface MessageJob {
  chatId: string;
  text: string;
  photo?: string;
  reply_markup?: any;
}

export interface ReminderJob {
  sessionId: number;
}

export interface BroadcastNewsJob {
  newsId: number;
}
