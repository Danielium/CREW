"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export function TelegramBackButton() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const tg = (window as any).Telegram?.WebApp;
    if (!tg || !tg.BackButton) return;

    // Define root pages where the back button should NOT be shown
    const isRootPage = 
      pathname === "/" || 
      pathname === "/map" || 
      pathname === "/feed" || 
      pathname === "/profile" || 
      pathname === "/club" || 
      pathname === "/login" ||
      pathname === "/map/requests"; // Assuming requests might be a root-level tab view

    if (isRootPage) {
      tg.BackButton.hide();
    } else {
      tg.BackButton.show();
    }

    const handleBackClick = () => {
      router.back();
    };

    tg.BackButton.onClick(handleBackClick);

    return () => {
      tg.BackButton.offClick(handleBackClick);
    };
  }, [pathname, router]);

  return null;
}
