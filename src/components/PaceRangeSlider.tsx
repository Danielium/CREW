"use client";
import { useRef, useState } from "react";
import { triggerHaptic } from "@/lib/haptics";

function formatPace(v: number) {
  const m = Math.floor(v);
  const s = Math.round((v - m) * 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function paceRangeToString(from: number, to: number): string {
  const a = formatPace(from);
  const b = formatPace(to);
  return a === b ? a : `${a} - ${b}`;
}

// Best-effort parse of legacy pace strings ("5:30" or "5:00 - 6:00") back into slider values
export function parsePaceRange(pace: string | null | undefined, fallbackFrom = 5, fallbackTo = 6): [number, number] {
  if (!pace) return [fallbackFrom, fallbackTo];
  const clean = pace.replace(/[\[\]"']/g, "");
  const parts = clean.split(/-|,/).map(p => p.trim()).filter(Boolean);
  const toDec = (s: string) => {
    const [m, sec] = s.split(":").map(Number);
    if (isNaN(m)) return null;
    return m + (sec || 0) / 60;
  };
  const a = parts[0] ? toDec(parts[0]) : null;
  const b = parts[1] ? toDec(parts[1]) : a;
  if (a === null) return [fallbackFrom, fallbackTo];
  return [a, b ?? a];
}

interface PaceRangeSliderProps {
  from: number;
  to: number;
  onChange: (from: number, to: number) => void;
  paceAny: boolean;
  onPaceAnyChange: (v: boolean) => void;
  min?: number;
  max?: number;
  step?: number;
}

type Thumb = "from" | "to";

export function PaceRangeSlider({
  from,
  to,
  onChange,
  paceAny,
  onPaceAnyChange,
  min = 3,
  max = 9,
  step = 0.25,
}: PaceRangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingThumb = useRef<Thumb | null>(null);
  const [topThumb, setTopThumb] = useState<Thumb>("to");

  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const clampToRange = (v: number) => Math.min(max, Math.max(min, v));
  const snap = (v: number) => Math.round(v / step) * step;

  const valueFromClientX = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return min;
    const rect = track.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    return clampToRange(snap(min + ratio * (max - min)));
  };

  const applyValue = (thumb: Thumb, v: number) => {
    if (thumb === "from") {
      onChange(Math.min(v, to - step), to);
    } else {
      onChange(from, Math.max(v, from + step));
    }
  };

  const beginDrag = (thumb: Thumb, pointerId: number, target: EventTarget) => {
    if (paceAny) onPaceAnyChange(false);
    triggerHaptic("light");
    draggingThumb.current = thumb;
    setTopThumb(thumb);
    (target as HTMLElement).setPointerCapture?.(pointerId);
  };

  const handleThumbPointerDown = (thumb: Thumb) => (e: React.PointerEvent) => {
    e.stopPropagation();
    beginDrag(thumb, e.pointerId, e.currentTarget);
  };

  const handleTrackPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const v = valueFromClientX(e.clientX);
    const thumb: Thumb = Math.abs(v - from) <= Math.abs(v - to) ? "from" : "to";
    beginDrag(thumb, e.pointerId, e.currentTarget);
    applyValue(thumb, v);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingThumb.current) return;
    e.stopPropagation();
    applyValue(draggingThumb.current, valueFromClientX(e.clientX));
  };

  const endDrag = (e: React.PointerEvent) => {
    e.stopPropagation();
    draggingThumb.current = null;
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs uppercase font-bold tracking-wider text-muted">Ожидаемый темп</label>
        <button
          type="button"
          onClick={() => {
            triggerHaptic("light");
            onPaceAnyChange(!paceAny);
          }}
          className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-colors ${
            paceAny ? "bg-primary text-black" : "bg-muted/20 text-muted"
          }`}
        >
          Не важен
        </button>
      </div>

      <div className={`bg-card border border-border rounded-2xl p-4 flex flex-col gap-3 transition-opacity ${paceAny ? "opacity-40" : ""}`}>
        <div className="flex items-center justify-center gap-2 text-lg font-black">
          <span>{formatPace(from)}</span>
          <span className="text-muted font-medium text-sm">–</span>
          <span>{formatPace(to)}</span>
          <span className="text-muted font-medium text-xs self-end mb-1">мин/км</span>
        </div>

        <div
          ref={trackRef}
          className="relative h-8 flex items-center touch-none select-none"
          style={{ touchAction: "none" }}
          onPointerDown={handleTrackPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <div className="absolute left-2.5 right-2.5 h-1.5 bg-border rounded-full" />
          <div
            className="absolute h-1.5 bg-primary rounded-full"
            style={{ left: `calc(${pct(from)}% * 0.94 + 3%)`, right: `calc(${100 - pct(to)}% * 0.94 + 3%)` }}
          />
          <div
            onPointerDown={handleThumbPointerDown("from")}
            className="absolute w-6 h-6 -translate-x-1/2 rounded-full bg-primary border-[3px] border-black shadow-[0_2px_6px_rgba(0,0,0,0.4)]"
            style={{ left: `calc(${pct(from)}% * 0.94 + 3%)`, zIndex: topThumb === "from" ? 5 : 3 }}
          />
          <div
            onPointerDown={handleThumbPointerDown("to")}
            className="absolute w-6 h-6 -translate-x-1/2 rounded-full bg-primary border-[3px] border-black shadow-[0_2px_6px_rgba(0,0,0,0.4)]"
            style={{ left: `calc(${pct(to)}% * 0.94 + 3%)`, zIndex: topThumb === "to" ? 5 : 3 }}
          />
        </div>
      </div>
    </div>
  );
}
