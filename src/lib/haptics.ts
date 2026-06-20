import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export const triggerHaptic = async (style: 'light' | 'medium' | 'heavy' = 'light') => {
  if (typeof window === "undefined") return;

  // 1. Try Telegram Web App Haptics
  const tg = (window as any).Telegram?.WebApp;
  if (tg?.HapticFeedback) {
    try {
      tg.HapticFeedback.impactOccurred(style);
      return;
    } catch (e) {
      console.error("Telegram haptic failed", e);
    }
  }

  // 2. Try Capacitor Native Haptics
  if (Capacitor.isNativePlatform()) {
    try {
      let capStyle = ImpactStyle.Light;
      if (style === 'medium') capStyle = ImpactStyle.Medium;
      if (style === 'heavy') capStyle = ImpactStyle.Heavy;
      await Haptics.impact({ style: capStyle });
      return;
    } catch (e) {
      console.error("Capacitor haptic failed", e);
    }
  }

  // 3. Fallback to standard web vibration API (Android mostly)
  if (navigator.vibrate) {
    if (style === 'light') navigator.vibrate(10);
    else if (style === 'medium') navigator.vibrate(30);
    else if (style === 'heavy') navigator.vibrate(50);
  }
};
