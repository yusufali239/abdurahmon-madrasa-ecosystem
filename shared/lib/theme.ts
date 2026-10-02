/** Тема оформления: auto (как в Telegram/системе), light, dark. Хранится в localStorage. */
export type ThemeMode = 'auto' | 'light' | 'dark';
const KEY = 'madrasa.theme';

export function getThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

/** Системная тема: сначала Telegram (если открыто в Telegram), потом настройка устройства */
function systemIsDark(): boolean {
  const tg = (window as any).Telegram?.WebApp;
  if (tg?.initData && tg.colorScheme) return tg.colorScheme === 'dark';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export function applyTheme(mode: ThemeMode = getThemeMode()) {
  const dark = mode === 'dark' || (mode === 'auto' && systemIsDark());
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  const bg = dark ? '#0E1715' : '#FAF7F2';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  try {
    const tg = (window as any).Telegram?.WebApp;
    tg?.setHeaderColor?.(bg);
    tg?.setBackgroundColor?.(bg);
  } catch {
    /* вне Telegram */
  }
  return dark;
}

export function setThemeMode(mode: ThemeMode) {
  try {
    if (mode === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, mode);
  } catch {
    /* noop */
  }
  applyTheme(mode);
}

/** Следить за сменой системной темы и темы Telegram в режиме auto */
export function watchSystemTheme() {
  const onChange = () => getThemeMode() === 'auto' && applyTheme('auto');
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', onChange);
  try {
    (window as any).Telegram?.WebApp?.onEvent?.('themeChanged', onChange);
  } catch {
    /* noop */
  }
}
