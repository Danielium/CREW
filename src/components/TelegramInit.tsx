"use client";

import { useEffect } from "react";

export function TelegramInit() {
  useEffect(() => {
    // Prevent native browser overscroll/bounce
    const preventBounce = (e: TouchEvent) => {
      let target = e.target as HTMLElement | null;
      while (target && target !== document.body) {
        if (target.scrollHeight > target.clientHeight || target.scrollWidth > target.clientWidth) {
          return;
        }
        target = target.parentElement;
      }
      e.preventDefault();
    };
    document.addEventListener("touchmove", preventBounce, { passive: false });

    if (typeof window === "undefined" || !(window as any).Telegram?.WebApp) {
      return () => document.removeEventListener("touchmove", preventBounce);
    }

    const tg = (window as any).Telegram.WebApp;

    // This exact order was confirmed working: ready -> expand -> requestFullscreen
    tg.ready();
    tg.expand();

    // Fullscreen IMMEDIATELY after expand — no other calls in between
    const tryFullscreen = () => {
      if (tg.requestFullscreen) {
        try { tg.requestFullscreen(); } catch (e) {}
      }
    };

    // Try immediately
    tryFullscreen();

    // Everything else AFTER fullscreen has been requested
    tg.setHeaderColor("#000000");
    tg.setBackgroundColor("#000000");

    if (tg.disableVerticalSwipes) {
      try { tg.disableVerticalSwipes(); } catch (e) {}
    }

    // EXTREMELY AGGRESSIVE FULLSCREEN LOCK
    // We attach to all possible user interactions. Once fullscreen is achieved, we don't spam it.
    const forceFullscreenOnInteraction = () => {
      if (tg.isFullscreen) return; // already in fullscreen
      tryFullscreen();
    };

    document.addEventListener("click", forceFullscreenOnInteraction, { capture: true });
    document.addEventListener("touchstart", forceFullscreenOnInteraction, { passive: true, capture: true });
    document.addEventListener("touchend", forceFullscreenOnInteraction, { passive: true, capture: true });
    document.addEventListener("scroll", forceFullscreenOnInteraction, { passive: true, capture: true });

    tg.onEvent?.("viewport_changed", tryFullscreen);
    tg.onEvent?.("fullscreen_changed", forceFullscreenOnInteraction);

    return () => {
      document.removeEventListener("touchmove", preventBounce);
      document.removeEventListener("click", forceFullscreenOnInteraction, { capture: true } as any);
      document.removeEventListener("touchstart", forceFullscreenOnInteraction, { capture: true } as any);
      document.removeEventListener("touchend", forceFullscreenOnInteraction, { capture: true } as any);
      document.removeEventListener("scroll", forceFullscreenOnInteraction, { capture: true } as any);
    };
  }, []);

  return null;
}
