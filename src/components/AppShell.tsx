"use client";

import { createContext, useContext, useRef } from "react";

const ShellRefContext = createContext<React.RefObject<HTMLDivElement | null> | null>(null);

/** The AppShell's own DOM node, for anything that needs to measure or position against the phone-width frame (e.g. the onboarding overlay). */
export function useShellRef() {
  return useContext(ShellRefContext);
}

/**
 * The phone-width frame every screen renders inside. Exposes its ref via
 * context so descendants (like the onboarding overlay, mounted deeper in the
 * tree once the splash screen clears) can measure against it without prop
 * drilling.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const shellRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={shellRef}
      className="w-full max-w-[480px] bg-background relative shadow-2xl overflow-hidden flex flex-col mx-auto"
      style={{ height: "var(--tg-viewport-stable-height, 100dvh)" }}
    >
      <ShellRefContext.Provider value={shellRef}>{children}</ShellRefContext.Provider>
    </div>
  );
}
