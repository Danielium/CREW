"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { OnboardingStep } from "@/lib/onboarding";

type Rect = { x: number; y: number; w: number; h: number };

const SPOT_PAD = 8; // breathing room between the element and the cutout edge
const CARD_GAP = 14; // distance from cutout to the card's notch
const EDGE = 16; // minimum margin from the shell edges

/** Rounded-rect subpath, traced clockwise so evenodd punches it out of the scrim. */
function roundedRectPath(r: Rect, radius: number) {
  const rad = Math.min(radius, r.w / 2, r.h / 2);
  const { x, y, w, h } = r;
  return [
    `M${x + rad},${y}`,
    `H${x + w - rad}`,
    `A${rad},${rad} 0 0 1 ${x + w},${y + rad}`,
    `V${y + h - rad}`,
    `A${rad},${rad} 0 0 1 ${x + w - rad},${y + h}`,
    `H${x + rad}`,
    `A${rad},${rad} 0 0 1 ${x},${y + h - rad}`,
    `V${y + rad}`,
    `A${rad},${rad} 0 0 1 ${x + rad},${y}`,
    "Z",
  ].join(" ");
}

export default function OnboardingHint({
  step,
  shellRef,
  onDismiss,
}: {
  step: OnboardingStep;
  shellRef: React.RefObject<HTMLElement | null>;
  onDismiss: () => void;
}) {
  const [shell, setShell] = useState<Rect | null>(null);
  const [spot, setSpot] = useState<Rect | null>(null);
  const [entered, setEntered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(0);

  // Measure the shell and the anchored element, in shell-local coordinates.
  useLayoutEffect(() => {
    const measure = () => {
      const shellEl = shellRef.current;
      if (!shellEl) return;
      const sr = shellEl.getBoundingClientRect();
      setShell({ x: 0, y: 0, w: sr.width, h: sr.height });

      if (!step.anchor) {
        setSpot(null);
        return;
      }
      const el = document.querySelector<HTMLElement>(`[data-onboarding="${step.anchor}"]`);
      if (!el) {
        setSpot(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setSpot({
        x: r.left - sr.left - SPOT_PAD,
        y: r.top - sr.top - SPOT_PAD,
        w: r.width + SPOT_PAD * 2,
        h: r.height + SPOT_PAD * 2,
      });
    };

    measure();
    // Layout settles over a few frames (fonts, images, the nav's transform).
    const raf1 = requestAnimationFrame(measure);
    const raf2 = requestAnimationFrame(() => requestAnimationFrame(measure));

    const scroller = document.getElementById("main-scroll-container");
    scroller?.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    if (shellRef.current) ro.observe(shellRef.current);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      scroller?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      ro.disconnect();
    };
  }, [step, shellRef]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  });

  useEffect(() => {
    const t = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  if (!shell) return null;

  const radius = (step.anchorRadius ?? 16) + SPOT_PAD;

  // Place the card on whichever side of the spotlight has room; unanchored hints
  // sit low, above the nav, where the thumb already is.
  let cardTop: number;
  let notchTop = false;
  if (spot) {
    const below = spot.y + spot.h + CARD_GAP;
    const fitsBelow = below + cardH + EDGE <= shell.h;
    if (fitsBelow) {
      cardTop = below;
      notchTop = true;
    } else {
      cardTop = spot.y - CARD_GAP - cardH;
    }
    cardTop = Math.max(EDGE, Math.min(cardTop, shell.h - cardH - EDGE));
  } else {
    cardTop = Math.max(EDGE, shell.h - cardH - 132);
  }

  // Notch tracks the element's horizontal centre, clamped inside the card's corners.
  const notchX = spot
    ? Math.max(EDGE + 26, Math.min(spot.x + spot.w / 2, shell.w - EDGE - 26))
    : shell.w / 2;

  const scrimPath = spot
    ? `${roundedRectPath({ x: 0, y: 0, w: shell.w, h: shell.h }, 0)} ${roundedRectPath(spot, radius)}`
    : roundedRectPath({ x: 0, y: 0, w: shell.w, h: shell.h }, 0);

  const ease = "cubic-bezier(0.16, 1, 0.3, 1)";

  return (
    <div
      className="absolute inset-0 z-[200]"
      role="dialog"
      aria-modal="true"
      aria-label={step.title}
      onClick={onDismiss}
    >
      {/* Scrim with the element punched out — one path, so there are no seams. */}
      <svg
        width={shell.w}
        height={shell.h}
        viewBox={`0 0 ${shell.w} ${shell.h}`}
        className="absolute inset-0"
        style={{
          opacity: entered ? 1 : 0,
          transition: `opacity 420ms ${ease}`,
        }}
        aria-hidden
      >
        <path d={scrimPath} fillRule="evenodd" fill="rgba(0,0,0,0.78)" />
        {spot && (
          <g
            style={{
              transformOrigin: `${spot.x + spot.w / 2}px ${spot.y + spot.h / 2}px`,
              transform: entered ? "scale(1)" : "scale(1.05)",
              opacity: entered ? 1 : 0,
              transition: `transform 560ms ${ease}, opacity 560ms ${ease}`,
            }}
          >
            <path
              d={roundedRectPath(spot, radius)}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={1.5}
              opacity={0.9}
            />
          </g>
        )}
      </svg>

      <div
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
        className="absolute bg-card/80 backdrop-blur-2xl border border-white/10 rounded-[22px] p-5 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.9)]"
        style={{
          left: EDGE,
          right: EDGE,
          top: cardTop,
          width: `calc(100% - ${EDGE * 2}px)`,
          opacity: entered ? 1 : 0,
          transform: entered ? "translateY(0)" : `translateY(${notchTop ? -10 : 10}px)`,
          transition: `opacity 480ms ${ease} 90ms, transform 620ms ${ease} 90ms`,
        }}
      >
        {spot && (
          <div
            className="absolute w-3.5 h-3.5 bg-card/80 border-white/10 rotate-45"
            style={{
              left: notchX - EDGE - 7,
              [notchTop ? "top" : "bottom"]: -7,
              borderTopWidth: notchTop ? 1 : 0,
              borderLeftWidth: notchTop ? 1 : 0,
              borderRightWidth: notchTop ? 0 : 1,
              borderBottomWidth: notchTop ? 0 : 1,
            }}
            aria-hidden
          />
        )}

        <button
          onClick={onDismiss}
          aria-label="Закрыть подсказку"
          className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-foreground hover:bg-white/5 transition-colors"
        >
          <X size={16} />
        </button>

        <h2 className="font-black uppercase tracking-tight text-[19px] leading-tight pr-9 drop-shadow-sm">
          {step.title}
        </h2>
        <p className="text-sm text-muted leading-relaxed mt-2.5">{step.body}</p>

        <button
          onClick={onDismiss}
          className="mt-5 w-full bg-primary text-black font-bold uppercase tracking-wider text-xs py-3.5 rounded-2xl hover:bg-[#b3e600] active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
        >
          Понятно
        </button>
      </div>
    </div>
  );
}
