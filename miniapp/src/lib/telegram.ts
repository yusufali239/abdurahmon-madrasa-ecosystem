import WebApp from '@twa-dev/sdk';
import { applyTheme, watchSystemTheme } from '@shared/lib/theme';

/** Обёртка над Telegram WebApp SDK с безопасными fallback вне Telegram */
export const tg = WebApp;

export const inTelegram = () => Boolean(WebApp.initData);

export function initTelegram() {
  try {
    WebApp.ready();
    WebApp.expand();
  } catch {
    /* вне Telegram */
  }
  // Тема: выбор пользователя (Avto / Yorug' / Qorong'i), по умолчанию — как в Telegram
  applyTheme();
  watchSystemTheme();
}

export function haptic(type: 'success' | 'error' | 'warning' | 'light' = 'light') {
  try {
    if (type === 'light') WebApp.HapticFeedback.impactOccurred('light');
    else WebApp.HapticFeedback.notificationOccurred(type);
  } catch {
    /* noop */
  }
}

export function openLink(url: string) {
  try {
    if (inTelegram()) return WebApp.openLink(url);
  } catch {
    /* noop */
  }
  window.open(url, '_blank', 'noopener');
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    el.remove();
  }
  haptic('success');
}
