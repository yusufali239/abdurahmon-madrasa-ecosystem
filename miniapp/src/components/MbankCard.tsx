import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, ImagePlus, X } from 'lucide-react';
import { cn, som } from '@shared/lib/utils';
import { copyText } from '@/lib/telegram';

/** Реквизиты MBank: крупный номер, кнопка копирования и QR-код */
export function MbankCard({ number, name, amount, note }: { number: string; name: string; amount?: number; note?: string }) {
  const [copied, setCopied] = useState<'num' | 'sum' | null>(null);
  const display = number.replace(/^\+?(996)(\d{3})(\d{3})(\d{3})$/, '+$1 $2 $3 $4');
  const copy = async (what: 'num' | 'sum', text: string) => {
    await copyText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 1600);
  };
  // QR содержит номер и сумму — удобно сканировать камерой и вставлять в MBank
  const qrValue = `MBANK:${number.replace(/\s/g, '')}${amount ? `;SUM:${amount}` : ''}${note ? `;NOTE:${note}` : ''}`;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B5E46] via-[#0E7A5A] to-[#13906b] p-5 text-white shadow-soft">
      <div className="ornament absolute inset-0 opacity-60" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-white/70">MBank</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-white/90">{name}</p>
          {amount ? <p className="mt-3 text-3xl font-extrabold tracking-tight">{som(amount)}</p> : null}
        </div>
        <div className="shrink-0 rounded-2xl bg-white p-2 shadow-lg">
          <QRCodeSVG value={qrValue} size={92} fgColor="#0B3F31" bgColor="#ffffff" level="M" />
        </div>
      </div>
      <div className="relative mt-4 flex items-center gap-2">
        <button
          onClick={() => copy('num', number)}
          className="flex flex-1 items-center justify-between rounded-2xl bg-white/12 px-4 py-3 text-left ring-1 ring-white/20 backdrop-blur transition active:scale-[.99]"
        >
          <span className="whitespace-nowrap font-mono text-[15px] font-bold tracking-wide">{display}</span>
          {copied === 'num' ? <Check className="size-5 text-[#E2C98D]" /> : <Copy className="size-5 text-white/80" />}
        </button>
        {amount ? (
          <button
            onClick={() => copy('sum', String(amount))}
            className="rounded-2xl bg-[#C4A15A] px-3 py-3 text-xs font-extrabold text-[#2b1f08] transition active:scale-95"
          >
            {copied === 'sum' ? <Check className="size-5" /> : 'Summa'}
          </button>
        ) : null}
      </div>
      <p className="relative mt-3 text-[11px] text-white/70">Raqamni nusxalang → MBank ilovasida o'tkazma qiling → chekni yuklang.</p>
    </div>
  );
}

/** Загрузка чека (фото или PDF) с превью */
export function ReceiptInput({ file, onChange }: { file: File | null; onChange: (f: File | null) => void }) {
  const preview = file && file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
  return (
    <label
      className={cn(
        'relative flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed p-3 transition',
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
        <img src={preview} alt="Chek" className="size-14 rounded-xl object-cover" />
      ) : (
        <span className="grid size-14 place-items-center rounded-xl bg-gold-soft text-gold-foreground dark:text-gold">
          <ImagePlus className="size-6" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{file ? 'Chek tanlandi' : 'Chekni yuklang'}</p>
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
