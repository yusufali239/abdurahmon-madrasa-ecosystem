import WebApp from '@twa-dev/sdk';

/** Обёртка над Telegram WebApp SDK с безопасными fallback вне Telegram */
export const tg = WebApp;

export const inTelegram = () => Boolean(WebApp.initData);

export function initTelegram() {
  try {
    WebApp.ready();
    WebApp.expand();
    if (WebApp.colorScheme === 'dark') document.documentElement.classList.add('dark');
    const bg = WebApp.colorScheme === 'dark' ? '#0e1715' : '#FAF7F2';
    WebApp.setHeaderColor?.(bg as `#${string}`);
    WebApp.setBackgroundColor?.(bg as `#${string}`);
  } catch {
    /* вне Telegram */
  }
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
