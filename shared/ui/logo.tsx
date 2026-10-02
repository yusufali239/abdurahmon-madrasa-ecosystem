import { cn } from '../lib/utils';

/** Логотип мадрасы: 8-конечная звезда (Rub el Hizb), михраб, открытая книга и полумесяц */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={cn('size-10', className)} role="img" aria-label="Abdurahmon ibn Avf madrasasi">
      <g transform="translate(60 60)">
        <rect x="-46" y="-46" width="92" height="92" rx="14" fill="#0E7A5A" />
        <rect x="-46" y="-46" width="92" height="92" rx="14" fill="#0E7A5A" transform="rotate(45)" />
        <rect x="-40" y="-40" width="80" height="80" rx="11" fill="none" stroke="#C4A15A" strokeWidth="2.5" />
        <rect x="-40" y="-40" width="80" height="80" rx="11" fill="none" stroke="#C4A15A" strokeWidth="2.5" transform="rotate(45)" />
      </g>
      <path d="M60 26c-11 6-18 15-18 27v31h36V53c0-12-7-21-18-27z" fill="#FAF7F2" />
      <path d="M60 33c-7 4.5-11.5 11-11.5 20v4h23v-4c0-9-4.5-15.5-11.5-20z" fill="#C4A15A" opacity=".9" />
      <path
        d="M41 74c7-2.6 13.2-2 19 2.4 5.8-4.4 12-5 19-2.4v12c-7-2.6-13.2-2-19 2.4-5.8-4.4-12-5-19-2.4z"
        fill="#0E7A5A"
        stroke="#FAF7F2"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M60 76.4v12" stroke="#C4A15A" strokeWidth="2" strokeLinecap="round" />
      <path d="M64.5 40.5a5.2 5.2 0 1 1-6.2-6.6 4.2 4.2 0 1 0 6.2 6.6z" fill="#0E7A5A" />
    </svg>
  );
}

export function Logo({ className, subtitle = 'madrasasi' }: { className?: string; subtitle?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      <div className="leading-tight">
        <div className="text-[15px] font-extrabold tracking-tight">Abdurahmon ibn Avf</div>
        <div className="text-[11px] font-semibold uppercase tracking-[.18em] text-gold">{subtitle}</div>
      </div>
    </div>
  );
}
