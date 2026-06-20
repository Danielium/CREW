"use client";

import { useEffect } from "react";

export function TelegramInit() {
  useEffect(() => {
    // Проверяем, запущен ли код в браузере и доступен ли объект Telegram
    if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;
      tg.ready();
      tg.expand();
      
      // Попытка программно включить настоящий фуллскрин (Telegram 10.14+) с ретраями
      const tryFullscreen = (retries = 3) => {
        if (tg.requestFullscreen) {
          try { tg.requestFullscreen(); } catch (e) {}
        } else if (retries > 0) {
          setTimeout(() => tryFullscreen(retries - 1), 500);
        }
      };
      tryFullscreen();
      
      tg.setHeaderColor("#000000");
      tg.setBackgroundColor("#000000");
    }
  }, []);

  return null;
}
