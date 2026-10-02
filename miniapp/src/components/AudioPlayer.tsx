import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Pause, Play, RotateCcw, RotateCw } from 'lucide-react';
import { cn } from '@shared/lib/utils';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const SPEEDS = [1, 1.25, 1.5, 2, 0.75];

/** Аудио-плеер с волновой формой (Wavesurfer.js) */
export function AudioPlayer({ url, title }: { url: string; title: string }) {
  const container = useRef<HTMLDivElement>(null);
  const ws = useRef<WaveSurfer | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!container.current) return;
    const dark = document.documentElement.classList.contains('dark');
    const w = WaveSurfer.create({
      container: container.current,
      url,
      height: 52,
      barWidth: 3,
      barGap: 2,
      barRadius: 3,
      cursorWidth: 0,
      waveColor: dark ? 'rgba(250,247,242,.18)' : 'rgba(14,122,90,.18)',
      progressColor: '#0E7A5A',
      normalize: true,
      dragToSeek: true,
    });
    ws.current = w;
    w.on('ready', (d) => {
      setReady(true);
      setDuration(d);
    });
    w.on('timeupdate', setTime);
    w.on('play', () => setPlaying(true));
    w.on('pause', () => setPlaying(false));
    w.on('finish', () => setPlaying(false));
    w.on('error', () => setFailed(true));
    return () => w.destroy();
  }, [url]);

  const cycleSpeed = () => {
    const next = (speed + 1) % SPEEDS.length;
    setSpeed(next);
    ws.current?.setPlaybackRate(SPEEDS[next]);
  };

  if (failed) {
    // Фолбэк: обычный <audio>, если волну построить нельзя (CORS/формат)
    return (
      <div className="rounded-2xl border bg-card p-3">
        <p className="mb-2 text-sm font-semibold">{title}</p>
        <audio controls src={url} className="w-full" preload="none" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="line-clamp-1 text-sm font-bold">{title}</p>
        <button onClick={cycleSpeed} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground">
          {SPEEDS[speed]}×
        </button>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => ws.current?.playPause()}
          disabled={!ready}
          className={cn(
            'grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition active:scale-95 disabled:opacity-60',
            playing && 'ring-4 ring-primary/15',
          )}
          aria-label={playing ? 'Pauza' : 'Ijro etish'}
        >
          {!ready ? (
            <span className="size-5 animate-spin rounded-full border-2 border-current border-r-transparent" />
          ) : playing ? (
            <Pause className="size-5 fill-current" />
          ) : (
            <Play className="ml-0.5 size-5 fill-current" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div ref={container} className="w-full" />
          <div className="mt-1 flex items-center justify-between text-[11px] font-semibold tabular-nums text-muted-foreground">
            <span>{fmt(time)}</span>
            <span className="flex gap-2">
              <button onClick={() => ws.current?.skip(-10)} aria-label="10 soniya orqaga">
                <RotateCcw className="size-3.5" />
              </button>
              <button onClick={() => ws.current?.skip(10)} aria-label="10 soniya oldinga">
                <RotateCw className="size-3.5" />
              </button>
            </span>
            <span>{fmt(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
