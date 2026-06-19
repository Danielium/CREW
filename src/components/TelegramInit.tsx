"use client";

import { useEffect } from "react";

export function TelegramInit() {
  useEffect(() => {
    // Проверяем, запущен ли код в браузере и доступен ли объект Telegram
    if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;
      tg.ready();
      tg.expand();
      
      // Попытка программно включить настоящий фуллскрин (Telegram 10.14+)
      if (tg.requestFullscreen) {
        try { tg.requestFullscreen(); } catch (e) {}
      }
      
      tg.setHeaderColor("#000000");
      tg.setBackgroundColor("#000000");

      // Принудительно задаем CSS-переменные для челок и кнопок
      const updateSafeAreas = () => {
        const root = document.documentElement;
        const pt = tg.safeAreaInset?.top || 0;
        const pb = tg.safeAreaInset?.bottom || 0;
        
        // Если WebApp в фуллскрине, но Telegram не отдал отступы, ставим дефолтные 40px для верхней шторки
        const finalTop = pt > 0 ? pt : (tg.isFullscreen ? 40 : 0);
        const finalBottom = pb > 0 ? pb : (tg.isFullscreen ? 24 : 0);

        root.style.setProperty('--safe-top', `${finalTop}px`);
        root.style.setProperty('--safe-bottom', `${finalBottom}px`);
      };

      updateSafeAreas();
      
      if (tg.onEvent) {
        tg.onEvent('safeAreaChanged', updateSafeAreas);
        tg.onEvent('fullscreenChanged', updateSafeAreas);
      }
    }
  }, []);

  return null;
}
