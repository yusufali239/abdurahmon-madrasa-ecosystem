import { useEffect, useRef } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return m ? m[1] : null;
}

/** Видео-плеер (Plyr): mp4/webm или YouTube */
export function VideoPlayer({ url, title, poster }: { url: string; title?: string; poster?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const yt = youtubeId(url);
    const el = document.createElement(yt ? 'div' : 'video');
    if (yt) {
      el.setAttribute('data-plyr-provider', 'youtube');
      el.setAttribute('data-plyr-embed-id', yt);
    } else {
      const v = el as HTMLVideoElement;
      v.src = url;
      v.playsInline = true;
      v.preload = 'metadata';
      if (poster) v.poster = poster;
    }
    ref.current.appendChild(el);
    const player = new Plyr(el, {
      controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'settings', 'pip', 'fullscreen'],
      settings: ['speed'],
      speed: { selected: 1, options: [0.75, 1, 1.25, 1.5, 2] },
      i18n: { speed: 'Tezlik', normal: 'Oddiy', play: 'Ijro', pause: 'Pauza', mute: "Ovozsiz", settings: 'Sozlamalar' },
      ratio: '16:9',
    });
    const host = ref.current;
    return () => {
      player.destroy();
      host.innerHTML = '';
    };
  }, [url, poster]);

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
      <div ref={ref} className="aspect-video w-full bg-black [&_.plyr]:h-full" />
      {title && <p className="px-3.5 py-2.5 text-sm font-bold">{title}</p>}
    </div>
  );
}
