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

    // Initialize using the official SDK approach
    const initTg = async () => {
      try {
        const { viewport, init, isTMA } = await import("@telegram-apps/sdk");
        
        if (await isTMA()) {
          init(); // Initialize SDK

          // Set colors and disable swipes via vanilla object as a safe fallback
          const tg = (window as any).Telegram?.WebApp;
          if (tg) {
            tg.setHeaderColor("#000000");
            tg.setBackgroundColor("#000000");
            if (tg.disableVerticalSwipes) {
              try { tg.disableVerticalSwipes(); } catch(e){}
            }
          }

          // Step 1: Mount viewport
          if (viewport.mount.isAvailable()) {
            await viewport.mount();
            // Step 2: Expand to full height first
            viewport.expand(); 
          }
          
          // Step 3: Wait a tiny bit for expand to settle before fullscreen
          await new Promise(r => setTimeout(r, 100));

          // Step 4: Request true Fullscreen (SDK handles the async logic)
          if (viewport.requestFullscreen.isAvailable()) {
            await viewport.requestFullscreen();
          }
        }
      } catch (error) {
        console.error("TG Init Error:", error);
      }
    };

    initTg();

    return () => {
      document.removeEventListener("touchmove", preventBounce);
    };
  }, []);

  return null;
}
