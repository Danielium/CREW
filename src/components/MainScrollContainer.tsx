"use client";

import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function MainScrollContainer({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [direction, setDirection] = useState(0);
  const [prevPath, setPrevPath] = useState(pathname);
  
  useEffect(() => {
    if (pathname !== prevPath) {
      const getIndex = (path: string) => {
        if (path === '/') return 0;
        if (path.startsWith('/feed')) return 1;
        if (path.startsWith('/club')) return 2;
        if (path.startsWith('/profile')) return 3;
        return -1;
      };

      const currIdx = getIndex(pathname);
      const prevIdx = getIndex(prevPath);

      if (currIdx !== -1 && prevIdx !== -1) {
        setDirection(currIdx > prevIdx ? 1 : -1);
      } else {
        setDirection(0);
      }
      setPrevPath(pathname);
    }
  }, [pathname, prevPath]);
  
  // Do not add bottom padding on pages without BottomNav
  const hideBottomNav = pathname === '/run' || pathname === '/login' || pathname.startsWith('/events/');
  
  const variants = {
    initial: (dir: number) => ({
      x: dir > 0 ? "100%" : dir < 0 ? "-100%" : "0%",
      opacity: 0.8,
    }),
    animate: {
      x: "0%",
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? "-100%" : dir < 0 ? "100%" : "0%",
      opacity: 0.8,
    }),
  };

  return (
    <div 
      id="main-scroll-container" 
      className={`flex-1 overflow-x-hidden relative z-10 ${hideBottomNav ? "" : "pb-24"}`}
    >
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.div
          key={pathname}
          custom={direction}
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="w-full h-full overflow-y-auto no-scrollbar"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
