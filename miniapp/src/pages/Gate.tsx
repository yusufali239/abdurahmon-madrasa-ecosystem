import { useQuery } from '@tanstack/react-query';
import { Clock, ShieldAlert, UserPlus } from 'lucide-react';
import { Button } from '@shared/ui/button';
import { Logo, LogoMark } from '@shared/ui/logo';
import { api, setDevId } from '@/lib/api';
import { openLink } from '@/lib/telegram';
import type { Me } from '@/lib/types';

const FALLBACK_BOT = import.meta.env.VITE_BOT_USERNAME || 'abdurahmon_madrasa_bot';

/** Username бота берётся с сервера (getMe), чтобы не настраивать вручную */
function useBotUsername() {
  const cfg = useQuery({ queryKey: ['auth-config'], queryFn: () => api<{ devAuth: boolean; botUsername: string }>('/auth/config'), retry: false });
  return cfg.data?.botUsername || FALLBACK_BOT;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="ornament flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-sm rounded-3xl border bg-card/95 p-7 shadow-soft backdrop-blur">{children}</div>
    </div>
  );
}

export function GateScreen({ kind, me, message }: { kind: 'loading' | 'unregistered' | 'pending' | 'error'; me?: Me; message?: string }) {
  const BOT = useBotUsername();
  if (kind === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <LogoMark className="size-16 animate-pulse" />
        <p className="font-arabic text-xl text-gold">بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيمِ</p>
      </div>
    );
  }
  const openBot = () => openLink(`https://t.me/${BOT}?start=app`);
  return (
    <Shell>
      <LogoMark className="mx-auto mb-4 size-16" />
      {kind === 'unregistered' && (
        <>
          <UserPlus className="mx-auto mb-2 size-6 text-gold" />
          <h1 className="text-xl font-extrabold">Avval ro'yxatdan o'ting</h1>
          <p className="mt-2 text-sm text-muted-foreground">Botda /start bosing: pasport, telefon va ismingizni yuboring. Admin tasdiqlagach ilova ochiladi.</p>
          <Button className="mt-6 w-full" onClick={openBot}>
            Botni ochish
          </Button>
        </>
      )}
      {kind === 'pending' && (
        <>
          <Clock className="mx-auto mb-2 size-6 text-gold" />
          <h1 className="text-xl font-extrabold">
            {me?.status === 'REJECTED' ? 'Ariza rad etildi' : me?.status === 'BLOCKED' ? 'Hisob bloklangan' : 'Arizangiz ko\'rib chiqilmoqda'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {me?.status === 'PENDING'
              ? `${me.fullName ?? ''}, admin tasdiqlashi bilan sizga botda xabar keladi. Jazakallohu xoyron!`
              : 'Batafsil ma\'lumot uchun botga murojaat qiling.'}
          </p>
          <Button variant="outline" className="mt-6 w-full" onClick={openBot}>
            Botga o'tish
          </Button>
        </>
      )}
      {kind === 'error' && (
        <>
          <ShieldAlert className="mx-auto mb-2 size-6 text-destructive" />
          <h1 className="text-xl font-extrabold">Xatolik</h1>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          <Button className="mt-6 w-full" onClick={() => location.reload()}>
            Qayta urinish
          </Button>
        </>
      )}
    </Shell>
  );
}

const DEMO_USERS = [
  { id: '100000010', name: 'Sardor domla', role: 'Ustoz · Fiqh' },
  { id: '100000011', name: 'Abdulloh domla', role: 'Ustoz · Aqida' },
  { id: '100000101', name: 'Karimov Azizbek', role: 'Talaba (to\'lagan)' },
  { id: '100000102', name: 'Toshpo\'latov Bilol', role: 'Talaba (to\'lov kutilmoqda)' },
  { id: '100000104', name: 'Yangi Talaba', role: 'Tasdiqlanmagan' },
];

/** Вне Telegram: в dev-режиме можно войти под демо-пользователем */
export function DevLogin() {
  const cfg = useQuery({ queryKey: ['auth-config'], queryFn: () => api<{ devAuth: boolean; botUsername: string }>('/auth/config'), retry: false });
  const BOT = cfg.data?.botUsername || FALLBACK_BOT;
  const login = (id: string) => {
    setDevId(id);
    location.reload();
  };
  return (
    <Shell>
      <Logo className="mx-auto mb-5 justify-center text-left" />
      <h1 className="text-lg font-extrabold">Telegram orqali oching</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Ilova Telegram botidagi «📱 Madrasa ilovasi» tugmasi orqali ishlaydi.</p>
      <Button className="mt-5 w-full" onClick={() => openLink(`https://t.me/${BOT}`)}>
        @{BOT}
      </Button>
      {cfg.data?.devAuth && (
        <div className="mt-6 border-t pt-5 text-left">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Dev rejim · demo foydalanuvchilar</p>
          <div className="space-y-1.5">
            {DEMO_USERS.map((u) => (
              <button key={u.id} onClick={() => login(u.id)} className="flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left hover:bg-muted">
                <span className="text-sm font-bold">{u.name}</span>
                <span className="text-[11px] text-muted-foreground">{u.role}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Shell>
  );
}
