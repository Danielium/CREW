"use client";

import { useEffect } from "react";

export function TelegramInit() {
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;

      const goFullscreen = () => {
        if (tg.requestFullscreen) {
          try { tg.requestFullscreen(); } catch (e) {}
        }
      };

      tg.ready();
      tg.expand();

      // Disable vertical swipe-to-close gesture
      if (tg.disableVerticalSwipes) {
        try { tg.disableVerticalSwipes(); } catch (e) {}
      }

      tg.setHeaderColor("#000000");
      tg.setBackgroundColor("#000000");

      // Request fullscreen immediately and on a few retries
      goFullscreen();
      setTimeout(goFullscreen, 100);
      setTimeout(goFullscreen, 500);
      setTimeout(goFullscreen, 1000);

      // Re-request fullscreen if the state changes (e.g. user exits fullscreen)
      tg.onEvent("fullscreen_changed", () => {
        if (!tg.isFullscreen) goFullscreen();
      });

      // Re-request fullscreen when viewport changes (menu button launch triggers resize)
      tg.onEvent("viewport_changed", () => {
        goFullscreen();
      });
    }

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
    return () => document.removeEventListener("touchmove", preventBounce);
  }, []);

  return null;
}
