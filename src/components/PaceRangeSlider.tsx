"use client";
import { useState } from "react";
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
  const [activeThumb, setActiveThumb] = useState<"from" | "to">("to");
  const pct = (v: number) => ((v - min) / (max - min)) * 100;

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

      <div
        className={`bg-card border border-border rounded-2xl p-4 flex flex-col gap-3 transition-opacity ${paceAny ? "opacity-40" : ""}`}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center gap-2 text-lg font-black">
          <span>{formatPace(from)}</span>
          <span className="text-muted font-medium text-sm">–</span>
          <span>{formatPace(to)}</span>
          <span className="text-muted font-medium text-xs self-end mb-1">мин/км</span>
        </div>

        <div className="relative h-6 flex items-center px-1">
          <div className="absolute left-1 right-1 h-1.5 bg-border rounded-full" />
          <div
            className="absolute h-1.5 bg-primary rounded-full"
            style={{ left: `calc(${pct(from)}% * 0.96 + 2px)`, right: `calc(${100 - pct(to)}% * 0.96 + 2px)` }}
          />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={from}
            onPointerDown={() => { setActiveThumb("from"); if (paceAny) onPaceAnyChange(false); }}
            onChange={(e) => {
              if (paceAny) onPaceAnyChange(false);
              const v = Math.min(parseFloat(e.target.value), to - step);
              onChange(v, to);
            }}
            style={{ zIndex: activeThumb === "from" ? 5 : 3 }}
            className="range-thumb absolute inset-x-0 w-full appearance-none bg-transparent pointer-events-none"
          />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={to}
            onPointerDown={() => { setActiveThumb("to"); if (paceAny) onPaceAnyChange(false); }}
            onChange={(e) => {
              if (paceAny) onPaceAnyChange(false);
              const v = Math.max(parseFloat(e.target.value), from + step);
              onChange(from, v);
            }}
            style={{ zIndex: activeThumb === "to" ? 5 : 3 }}
            className="range-thumb absolute inset-x-0 w-full appearance-none bg-transparent pointer-events-none"
          />
        </div>
      </div>
    </div>
  );
}
