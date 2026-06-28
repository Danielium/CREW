"use client";

import { useEffect } from "react";

export function TelegramInit() {
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;
      tg.ready();
      tg.expand();

      // Disable vertical swipe-to-close gesture
      if (tg.disableVerticalSwipes) {
        try { tg.disableVerticalSwipes(); } catch (e) {}
      }

      const tryFullscreen = () => {
        if (tg.requestFullscreen) {
          try { tg.requestFullscreen(); } catch (e) {}
        }
      };

      tryFullscreen();
      setTimeout(tryFullscreen, 100);

      tg.setHeaderColor("#000000");
      tg.setBackgroundColor("#000000");
    }

    // Prevent native browser overscroll/bounce on the document level
    const preventBounce = (e: TouchEvent) => {
      // Allow scrolling inside scrollable elements, block everything else
      let target = e.target as HTMLElement | null;
      while (target && target !== document.body) {
        if (target.scrollHeight > target.clientHeight || target.scrollWidth > target.clientWidth) {
          return; // allow scroll inside scrollable containers
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
