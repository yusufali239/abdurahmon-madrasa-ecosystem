import { useState } from 'react';
import { Check, Copy, ExternalLink, ImagePlus, X } from 'lucide-react';
import { cn, som } from '@shared/lib/utils';
import { copyText, openLink } from '@/lib/telegram';

/**
 * Реквизиты MBank: номер с кнопкой копирования, сумма и (если есть) ссылка на перевод.
 * QR убран: MBank не читает произвольный QR, а с того же телефона его не отсканировать.
 */
export function MbankCard({ number, amount, link }: { number: string; amount?: number; link?: string | null }) {
  const [copied, setCopied] = useState<'num' | 'sum' | null>(null);
  const digits = number.replace(/[^\d+]/g, '');
  const display = digits.replace(/^\+?(996)(\d{3})(\d{3})(\d{3})$/, '+$1 $2 $3 $4');
  const copy = async (what: 'num' | 'sum', text: string) => {
    await copyText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 1600);
  };

  return (
    <div className="space-y-2">
      <button onClick={() => copy('num', digits)} className="flex w-full items-center justify-between rounded-2xl border bg-card px-4 py-4 text-left">
        <div>
          <p className="text-xs text-muted-foreground">MBank raqami</p>
          <p className="mt-0.5 font-mono text-lg font-semibold tracking-wide">{display}</p>
        </div>
        <span className={cn('flex items-center gap-1.5 text-sm font-medium', copied === 'num' ? 'text-primary' : 'text-muted-foreground')}>
          {copied === 'num' ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied === 'num' ? 'Nusxalandi' : 'Nusxalash'}
        </span>
      </button>
      {amount ? (
        <button onClick={() => copy('sum', String(amount))} className="flex w-full items-center justify-between rounded-2xl border bg-card px-4 py-4 text-left">
          <div>
            <p className="text-xs text-muted-foreground">Summa</p>
            <p className="mt-0.5 text-lg font-semibold">{som(amount)}</p>
          </div>
          <span className={cn('flex items-center gap-1.5 text-sm font-medium', copied === 'sum' ? 'text-primary' : 'text-muted-foreground')}>
            {copied === 'sum' ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied === 'sum' ? 'Nusxalandi' : 'Nusxalash'}
          </span>
        </button>
      ) : null}
      {link && (
        <button
          onClick={() => openLink(link)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 px-4 py-3.5 text-sm font-semibold text-primary"
        >
          <ExternalLink className="size-4" /> MBank orqali o'tkazish
        </button>
      )}
      <p className="px-1 pt-1 text-xs text-muted-foreground">MBank ilovasida shu raqamga o'tkazing, so'ng chek rasmini yuklang.</p>
    </div>
  );
}

/** Загрузка чека (фото или PDF) с превью */
export function ReceiptInput({ file, onChange }: { file: File | null; onChange: (f: File | null) => void }) {
  const preview = file && file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
  return (
    <label
      className={cn(
        'relative flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed p-4 transition',
        file ? 'border-primary/50 bg-primary/5' : 'border-border hover:bg-muted/50',
      )}
    >
      <input
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {preview ? (
        <img src={preview} alt="Chek" className="size-12 rounded-xl object-cover" />
      ) : (
        <span className="grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
          <ImagePlus className="size-5" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{file ? 'Chek tanlandi' : 'Chek rasmini yuklang'}</p>
        <p className="truncate text-xs text-muted-foreground">{file ? file.name : 'Skrinshot yoki PDF (15 MB gacha)'}</p>
      </div>
      {file && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onChange(null);
          }}
          className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
          aria-label="Olib tashlash"
        >
          <X className="size-4" />
        </button>
      )}
    </label>
  );
}
