"use client";

import { useEffect, useRef, useState } from "react";

const DISMISS_THRESHOLD = 120;

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
  const [isMounted, setIsMounted] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartY = useRef(0);
  const offsetRef = useRef(0);
  const isDragging = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Slide in on the frame after mount so the transform actually animates.
  useEffect(() => {
    if (!open) {
      setIsMounted(false);
      setDragOffset(0);
      offsetRef.current = 0;
      return;
    }
    const raf = requestAnimationFrame(() => setIsMounted(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Sheets own the nav bar: it would otherwise sit above the sheet's actions.
  useEffect(() => {
    window.dispatchEvent(new Event(open ? "hideNav" : "showNav"));
    return () => { window.dispatchEvent(new Event("showNav")); };
  }, [open]);

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

  if (!open) return null;

  const translateY = isMounted ? dragOffset : window.innerHeight;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={ariaLabel || title}>
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300"
        style={{ opacity: isMounted ? Math.max(0, 1 - dragOffset / 400) : 0 }}
        onClick={() => !locked && onClose()}
      />
      <div
        className={`relative w-full max-w-[480px] bg-card border-t border-border rounded-t-[32px] px-6 pt-2 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] ${dragOffset > 0 ? "transition-none" : "transition-transform duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"}`}
        style={{
          transform: `translateY(${translateY}px)`,
          paddingBottom: "max(2rem, calc(env(safe-area-inset-bottom, 0px) + 1.5rem), var(--tg-content-safe-area-inset-bottom, var(--tg-safe-area-inset-bottom, 0px)))",
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
          {title && <h2 className="font-black uppercase tracking-tight text-lg mb-6">{title}</h2>}
          {children}
        </div>
        {footer && <div className="pt-6">{footer}</div>}
      </div>
    </div>
  );
}
