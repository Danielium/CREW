"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";

export function MainScrollContainer({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  
  // Do not add bottom padding on pages without BottomNav
  const hideBottomNav = pathname === '/run' || pathname === '/login' || pathname.startsWith('/events/');
  
  return (
    <div 
      id="main-scroll-container" 
      className={`flex-1 overflow-y-auto overflow-x-hidden no-scrollbar relative z-10 ${hideBottomNav ? "" : "pb-24"}`}
    >
      {children}
    </div>
  );
}
