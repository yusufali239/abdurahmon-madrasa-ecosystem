import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@shared/ui/button';
import { Logo } from '@shared/ui/logo';
import { api, setToken } from '@/lib/api';

const BOT = import.meta.env.VITE_BOT_USERNAME || 'abdurahmon_madrasa_bot';

/** Вход: одноразовая ссылка из бота (/admin), Telegram WebApp initData или dev-режим */
export default function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [devAuth, setDevAuth] = useState(false);
  const [loading, setLoading] = useState(false);

  const finish = (t: { accessToken: string }) => {
    setToken(t.accessToken);
    navigate('/', { replace: true });
  };

  useEffect(() => {
    const token = params.get('token');
    const initData = window.Telegram?.WebApp?.initData;
    if (token) {
      setLoading(true);
      api('/auth/admin/exchange', { body: { token } }).then(finish).catch((e) => setError(e.message)).finally(() => setLoading(false));
    } else if (initData) {
      setLoading(true);
      api('/auth/admin/telegram', { body: { initData } }).then(finish).catch((e) => setError(e.message)).finally(() => setLoading(false));
    }
    api<{ devAuth: boolean }>('/auth/config').then((c) => setDevAuth(c.devAuth)).catch(() => undefined);
  }, []);

  return (
    <div className="ornament flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border bg-card p-8 shadow-soft">
        <Logo className="mb-6" subtitle="Admin panel" />
        <h1 className="text-xl font-extrabold">Admin panelga kirish</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Telegram botda <code className="rounded bg-muted px-1.5 py-0.5 font-bold">/admin</code> buyrug'ini yuboring — bir martalik kirish havolasi keladi.
          Faqat <code>ADMIN_IDS</code> ro'yxatidagi foydalanuvchilar kira oladi.
        </p>
        {loading && <p className="mt-4 text-sm font-semibold text-primary">Tekshirilmoqda…</p>}
        {error && <p className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <Button className="mt-6 w-full" size="lg" onClick={() => window.open(`https://t.me/${BOT}?start=admin`, '_blank')}>
          Botni ochish
        </Button>
        {devAuth && (
          <Button variant="outline" className="mt-2 w-full" onClick={() => api('/auth/admin/dev', { method: 'POST' }).then(finish).catch((e) => setError(e.message))}>
            Dev rejimda kirish
          </Button>
        )}
      </div>
    </div>
  );
}
