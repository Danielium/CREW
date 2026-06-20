"use client";

import { useEffect } from "react";

export function TelegramInit() {
  useEffect(() => {
    // Проверяем, запущен ли код в браузере и доступен ли объект Telegram
    if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;
      tg.ready();
      tg.expand();
      
      // Агрессивный вызов requestFullscreen, так как при первой загрузке (пока идет анимация открытия шторки)
      // Telegram может игнорировать вызов.
      const tryFullscreen = () => {
        if (tg.requestFullscreen) {
          try { tg.requestFullscreen(); } catch (e) {}
        }
      };
      
      tryFullscreen();
      setTimeout(tryFullscreen, 100);
      setTimeout(tryFullscreen, 500);
      setTimeout(tryFullscreen, 1000);
      setTimeout(tryFullscreen, 2000);
      
      tg.setHeaderColor("#000000");
      tg.setBackgroundColor("#000000");
    }
  }, []);

  return null;
}
