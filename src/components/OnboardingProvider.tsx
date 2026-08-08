"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import OnboardingHint from "@/components/OnboardingHint";
import { useShellRef } from "@/components/AppShell";
import { pickStep, type OnboardingStep } from "@/lib/onboarding";

export default function OnboardingProvider() {
  const shellRef = useShellRef();
  const { status } = useSession();
  const pathname = usePathname();
  const [seenMask, setSeenMask] = useState<number | null>(null);
  const [step, setStep] = useState<OnboardingStep | null>(null);
  const dismissing = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    fetch("/api/onboarding", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && typeof d.seenMask === "number") setSeenMask(d.seenMask);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [status]);

  // Resolve the hint for this screen. The anchor may not exist yet — the splash
  // screen and the page's own data fetch both delay it — so wait for it to show
  // up rather than checking once and giving up.
  useEffect(() => {
    setStep(null);
    if (seenMask === null) return;
    const next = pickStep(pathname, seenMask);
    if (!next) return;

    let settled = false;
    const show = () => {
      if (settled) return;
      settled = true;
      dismissing.current = false;
      setStep(next);
    };

    // A short beat first, so the hint lands after the screen itself, not with it.
    const minDelay = 700;
    const startedAt = Date.now();
    const tryShow = () => {
      if (Date.now() - startedAt < minDelay) return;
      if (!next.anchor) return show();
      if (document.querySelector(`[data-onboarding="${next.anchor}"]`)) show();
    };

    const interval = setInterval(() => {
      tryShow();
      if (settled) clearInterval(interval);
    }, 120);
    // Give up if the anchor never arrives, so we don't poll forever.
    const giveUp = setTimeout(() => clearInterval(interval), 10000);

    return () => {
      settled = true;
      clearInterval(interval);
      clearTimeout(giveUp);
    };
  }, [pathname, seenMask]);

  const handleDismiss = () => {
    if (!step || dismissing.current) return;
    dismissing.current = true;
    const bit = step.bit;
    setStep(null);
    setSeenMask((m) => (m ?? 0) | bit);
    fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId: step.id }),
    }).catch(() => {});
  };

  if (!step || !shellRef) return null;
  return <OnboardingHint step={step} shellRef={shellRef} onDismiss={handleDismiss} />;
}
