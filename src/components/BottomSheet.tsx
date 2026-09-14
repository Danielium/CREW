"use client";

import { useEffect, useRef, useState } from "react";

const DISMISS_THRESHOLD = 120;
// Exported so callers can time their own post-close state resets (e.g. clearing
// a form) to land after the sheet has actually finished sliding away.
export const BOTTOM_SHEET_TRANSITION_MS = 500;
const TRANSITION_MS = BOTTOM_SHEET_TRANSITION_MS;

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Blocks swipe-to-dismiss and backdrop taps while a write is in flight. */
  locked?: boolean;
  ariaLabel?: string;
  /** Pinned below the scroll area, so the primary action never scrolls out of reach. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The app's one bottom sheet: grabber, swipe-to-dismiss, tap-outside.
 * Mirrors the map sheet's feel (same radius, same 120px dismiss threshold)
 * so every sheet in CREW closes the same way.
 */
export default function BottomSheet({ open, onClose, title, locked = false, ariaLabel, footer, children }: BottomSheetProps) {
  // Decoupled from `open`: stays true through the close animation, so a tap-outside
  // or Escape close slides the sheet away instead of the subtree vanishing mid-frame.
  const [shouldRender, setShouldRender] = useState(open);
  // Plays the CSS entrance exactly once per open. The entrance used to be a JS state
  // flip scheduled inside two nested requestAnimationFrames; that made it hostage to
  // frame scheduling, which on a loaded WebView either collapsed both frames into one
  // (sheet appeared instantly, nothing to animate) or starved them entirely (callback
  // never ran, so the panel stayed parked off-screen — the sheet "getting stuck").
  // Keyframes start when the element is inserted, so neither failure mode exists.
  const [entering, setEntering] = useState(open);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartY = useRef(0);
  const offsetRef = useRef(0);
  const isDragging = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // On close, keep rendering for one transition's worth before unmounting.
  useEffect(() => {
    if (open) {
      setShouldRender(true);
      setEntering(true);
      // onAnimationEnd is the normal way out of the entering state, but a starved
      // thread can delay that event past the animation itself — so the state is not
      // left to depend on it alone. Clearing late is harmless: the class and the
      // inline transform resolve to the same resting position.
      const settled = setTimeout(() => setEntering(false), TRANSITION_MS);
      return () => clearTimeout(settled);
    }
    setEntering(false);
    setDragOffset(0);
    offsetRef.current = 0;
    const timeout = setTimeout(() => setShouldRender(false), TRANSITION_MS);
    return () => clearTimeout(timeout);
  }, [open]);

  // Sheets own the nav bar: it would otherwise sit above the sheet's actions.
  // Tied to shouldRender, not open, so the nav doesn't pop back in while the
  // sheet is still sliding out.
  useEffect(() => {
    window.dispatchEvent(new Event(shouldRender ? "hideNav" : "showNav"));
    return () => { window.dispatchEvent(new Event("showNav")); };
  }, [shouldRender]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !locked) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, locked, onClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only start a drag from the top of the content, so scrolling still works.
    if (locked || (scrollRef.current?.scrollTop ?? 0) > 0) return;
    dragStartY.current = e.touches[0].clientY;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const diff = e.touches[0].clientY - dragStartY.current;
    if (diff > 0) {
      // Mirrored in a ref: touchend must read the live offset, not a render behind.
      offsetRef.current = diff;
      setDragOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const finalOffset = offsetRef.current;
    offsetRef.current = 0;
    if (finalOffset > DISMISS_THRESHOLD) {
      onClose();
    } else {
      setDragOffset(0);
    }
  };

  if (!shouldRender) return null;

  // While the entrance keyframes run they own the transform (animations outrank inline
  // styles in the cascade), and they land on exactly this resting value — so the two
  // never fight. Dragging drops the class, handing the transform back to this style.
  // Closing is a percentage, not window.innerHeight: it can't go stale on rotate.
  const isDragging0 = dragOffset > 0;
  const panelTransform = isDragging0 ? `translateY(${dragOffset}px)` : open ? "translateY(0)" : "translateY(100%)";
  const playEntrance = entering && !isDragging0;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || title}
      // The sheet stays mounted for one transition after close so it can slide away.
      // While it does, this full-screen layer must stop intercepting taps: a tap on a
      // map pin during those 500ms used to land on the fading backdrop and re-fire
      // onClose instead of opening the pin — the "tap does nothing, then the sheet
      // acts weird" case.
      style={{ pointerEvents: open ? "auto" : "none" }}
    >
      <div
        className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${playEntrance ? "sheet-backdrop-in" : ""}`}
        style={{ opacity: open ? Math.max(0, 1 - dragOffset / 400) : 0 }}
        onClick={() => !locked && onClose()}
      />
      <div
        // duration-500 below must match TRANSITION_MS above — it's what the unmount timer waits out.
        className={`relative w-full max-w-[480px] bg-card border-t border-border rounded-t-[32px] px-6 pt-2 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] ${
          playEntrance
            ? "sheet-in"
            : isDragging0
              ? "transition-none"
              : "transition-transform duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"
        }`}
        onAnimationEnd={() => setEntering(false)}
        style={{
          transform: panelTransform,
          // 4rem floor, not 2rem: some Android WebViews report no real safe-area
          // value at all, and 2rem previously let the 3-button nav bar overlap
          // the sheet's own actions (see commit e2321ca).
          paddingBottom: "max(4rem, calc(env(safe-area-inset-bottom, 0px) + 1.5rem), var(--tg-content-safe-area-inset-bottom, var(--tg-safe-area-inset-bottom, 0px)))",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <button
          type="button"
          onClick={() => !locked && onClose()}
          aria-label="Закрыть"
          className="block w-12 h-1.5 bg-muted/50 rounded-full mx-auto mb-6 disabled:opacity-30"
          disabled={locked}
        />
        <div ref={scrollRef} className="max-h-[70vh] overflow-y-auto no-scrollbar">
          {title && <h2 className="font-bold uppercase tracking-normal text-lg mb-6 font-display">{title}</h2>}
          {children}
        </div>
        {footer && <div className="pt-6">{footer}</div>}
      </div>
    </div>
  );
}
