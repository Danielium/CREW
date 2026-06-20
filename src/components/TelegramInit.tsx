"use client";

import { useEffect } from "react";

export function TelegramInit() {
  useEffect(() => {
    // Проверяем, запущен ли код в браузере и доступен ли объект Telegram
    if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;
      tg.ready();
      tg.expand();
      
      // Агрессивный вызов requestFullscreen
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

      // Жесткий хак: если это первый запуск сессии, принудительно перезагружаем страницу.
      // Telegram iOS/Android багует с requestFullscreen при первом открытии шторки.
      // При перезагрузке шторка уже открыта, и фуллскрин срабатывает мгновенно.
      if (!sessionStorage.getItem("tg_reloaded_for_fullscreen")) {
        sessionStorage.setItem("tg_reloaded_for_fullscreen", "true");
        window.location.reload();
      }
      
      tg.setHeaderColor("#000000");
      tg.setBackgroundColor("#000000");
    }
  }, []);

  return null;
}
