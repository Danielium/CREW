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

      // Request fullscreen immediately (might fail if requires user gesture)
      goFullscreen();
      setTimeout(goFullscreen, 100);
      setTimeout(goFullscreen, 500);

      // Re-request fullscreen if the state changes
      tg.onEvent("fullscreen_changed", () => {
        if (!tg.isFullscreen) goFullscreen();
      });

      // Re-request fullscreen when viewport changes
      tg.onEvent("viewport_changed", () => {
        goFullscreen();
      });

      // Telegram API requires user interaction to enter fullscreen if not launched as fullscreen Mini App
      const handleUserInteraction = () => {
        if (!tg.isFullscreen) goFullscreen();
        // We do not remove the listener because they might exit fullscreen and we want to allow them back in on next tap
      };

      document.addEventListener("click", handleUserInteraction);
      document.addEventListener("touchstart", handleUserInteraction, { passive: true });

      // Clean up on unmount
      return () => {
        document.removeEventListener("click", handleUserInteraction);
        document.removeEventListener("touchstart", handleUserInteraction);
      };
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
