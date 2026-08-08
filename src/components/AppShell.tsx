"use client";

import { useRef } from "react";
import OnboardingProvider from "@/components/OnboardingProvider";

/**
 * The phone-width frame every screen renders inside. It owns the ref that the
 * onboarding overlay measures against, so hints stay inside the frame instead of
 * spilling across the desktop viewport.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const shellRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={shellRef}
      className="w-full max-w-[480px] bg-background relative shadow-2xl overflow-hidden flex flex-col mx-auto"
      style={{ height: "var(--tg-viewport-stable-height, 100dvh)" }}
    >
      {children}
      <OnboardingProvider shellRef={shellRef} />
    </div>
  );
}
