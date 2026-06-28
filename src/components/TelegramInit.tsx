"use client";

import { useEffect } from "react";

export function TelegramInit() {
  useEffect(() => {
    // Prevent native browser overscroll/bounce on the document level
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

    const goFullscreen = () => {
      if (tg.requestFullscreen) {
        try { tg.requestFullscreen(); } catch (e) {}
      }
    };

    // Signal Telegram that the app is ready
    tg.ready();

    // Expand to full height (needed for older TG versions and as a prerequisite)
    tg.expand();

    // Disable vertical swipe-to-close gesture
    if (tg.disableVerticalSwipes) {
      try { tg.disableVerticalSwipes(); } catch (e) {}
    }

    tg.setHeaderColor("#000000");
    tg.setBackgroundColor("#000000");

    // Request fullscreen with multiple attempts at different intervals
    // to handle different launch contexts (Mini App vs Menu Button)
    goFullscreen();
    setTimeout(goFullscreen, 50);
    setTimeout(goFullscreen, 200);
    setTimeout(goFullscreen, 600);
    setTimeout(goFullscreen, 1500);

    // Re-request fullscreen if user exits it
    tg.onEvent("fullscreen_changed", () => {
      if (!tg.isFullscreen) goFullscreen();
    });

    // Re-request fullscreen on viewport change (fires during Menu Button launch)
    tg.onEvent("viewport_changed", () => {
      goFullscreen();
    });

    // Also try on any touch — last resort for restricted contexts
    const handleUserInteraction = () => {
      if (!tg.isFullscreen) goFullscreen();
    };
    document.addEventListener("touchstart", handleUserInteraction, { passive: true });

    return () => {
      document.removeEventListener("touchmove", preventBounce);
      document.removeEventListener("touchstart", handleUserInteraction);
    };
  }, []);

  return null;
}
