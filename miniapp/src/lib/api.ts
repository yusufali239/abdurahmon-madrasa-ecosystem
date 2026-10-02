import { tg } from './telegram';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const DEV_KEY = 'madrasa.devTelegramId';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function getDevId(): string | null {
  try {
    return localStorage.getItem(DEV_KEY) || import.meta.env.VITE_DEV_TELEGRAM_ID || null;
  } catch {
    return import.meta.env.VITE_DEV_TELEGRAM_ID || null;
  }
}

export function setDevId(id: string | null) {
  try {
    if (id) localStorage.setItem(DEV_KEY, id);
    else localStorage.removeItem(DEV_KEY);
  } catch {
    /* noop */
  }
}

/** Telegram initData (подпись проверяется на сервере) или dev-режим */
export function authHeader(): string | null {
  if (tg.initData) return `tma ${tg.initData}`;
  const dev = getDevId();
  return dev ? `dev ${dev}` : null;
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const auth = authHeader();
  if (auth) headers.Authorization = auth;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${API_URL}/api${path}`, { method: opts.method || (body ? 'POST' : 'GET'), headers, body });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message.join(', ') : data?.message || 'Xatolik yuz berdi';
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

export const absUrl = (u?: string | null) => (!u ? '' : u.startsWith('/') ? `${API_URL}${u}` : u);
