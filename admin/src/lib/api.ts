// Пустой VITE_API_URL в production-сборке = тот же домен (фронтенд раздаёт backend).
// Может прийти только host ("api.onrender.com") — добавляем https://
const rawApi = (import.meta.env.VITE_API_URL || (import.meta.env.PROD ? window.location.origin : 'http://localhost:3000')).trim().replace(/\/$/, '');
export const API_URL = /^https?:\/\//i.test(rawApi) ? rawApi : `https://${rawApi}`;
const KEY = 'madrasa.adminToken';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const getToken = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
export const setToken = (t: string | null) => {
  try {
    if (t) localStorage.setItem(KEY, t);
    else localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
};

/** Запрос к API админки (JWT Bearer). 401 -> выход на страницу входа */
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${API_URL}/api${path}`, { method: opts.method || (body ? 'POST' : 'GET'), headers, body });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (res.status === 401 && path.startsWith('/admin')) {
    setToken(null);
    if (!location.pathname.endsWith('/login')) location.href = `${import.meta.env.BASE_URL}login`;
  }
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message.join(', ') : data?.message || 'Xatolik';
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

export const absUrl = (u?: string | null) => (!u ? '' : u.startsWith('/') ? `${API_URL}${u}` : u);

/** Загрузка файла в хранилище; возвращает относительный url */
export async function uploadFile(file: File, kind: 'news' | 'reports' | 'content') {
  const form = new FormData();
  form.append('file', file);
  return api<{ url: string; absoluteUrl: string }>(`/admin/uploads?kind=${kind}`, { form });
}
