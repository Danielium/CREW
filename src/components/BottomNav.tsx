"use client";
import { useState, useEffect } from "react";
import { Map as MapIcon, Activity, Users, BarChart, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNav() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);
  const [isHiddenForce, setIsHiddenForce] = useState(false);

  useEffect(() => {
    const hide = () => setIsHiddenForce(true);
    const show = () => setIsHiddenForce(false);
    
    window.addEventListener("hideNav", hide);
    window.addEventListener("showNav", show);
    
    let lastScrollY = 0;
    let accumulatedScrollUp = 0;

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      const currentScrollY = target.scrollTop;
      const deltaY = currentScrollY - lastScrollY;
      
      if (deltaY > 0) {
        if (currentScrollY > 50) setIsVisible(false);
        accumulatedScrollUp = 0;
      } else if (deltaY < 0) {
        accumulatedScrollUp += Math.abs(deltaY);
        if (accumulatedScrollUp > 60 || currentScrollY < 20) setIsVisible(true);
      }
      
      lastScrollY = currentScrollY;
    };

    const container = document.getElementById("main-scroll-container");
    if (container) {
      container.addEventListener("scroll", handleScroll, { passive: true });
    }
    
    return () => {
      window.removeEventListener("hideNav", hide);
      window.removeEventListener("showNav", show);
      if (container) {
        container.removeEventListener("scroll", handleScroll);
      }
    };
  }, []);

  const navItems = [
    { name: "Карта", path: "/", icon: MapIcon },
    { name: "Лента", path: "/feed", icon: Activity },
    { name: "Клуб", path: "/club", icon: Users },
    { name: "Профиль", path: "/profile", icon: User },
  ];

  const activeIndex = navItems.findIndex(item => pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path)));

  if (pathname === '/login' || pathname.startsWith('/club/logo-builder') || pathname.startsWith('/map/create') || pathname.startsWith('/map/requests') || pathname.startsWith('/events/')) {
    return null;
  }

  return (
    <div 
      className={`fixed left-1/2 -translate-x-1/2 w-[calc(100%-4rem)] max-w-[416px] z-[100] transition-transform duration-300 ease-in-out ${(isVisible && !isHiddenForce) ? "translate-y-0" : "translate-y-[200%]"}`}
      style={{ bottom: "calc(1.5rem + var(--tg-content-safe-area-inset-bottom, var(--tg-safe-area-inset-bottom, 0px)))" }}
    >
      <div className="bg-card/70 backdrop-blur-3xl rounded-full px-2 py-1.5 flex justify-between items-center shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] border border-border">
        {navItems.map((item) => {
          const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
          const Icon = item.icon;
          return (
            <Link key={item.name} href={item.path} className="flex flex-col items-center justify-center flex-1 relative z-10 py-1 group">
              {/* Growing Pill Background */}
              <div 
                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary/20 rounded-full transition-all duration-300 ease-out z-0 ${
                  isActive ? 'w-[76px] h-[42px] opacity-100 scale-100' : 'w-0 h-0 opacity-0 scale-50'
                }`} 
              />
              {/* Icon */}
              <div className={`relative z-10 flex items-center justify-center mb-1 transition-colors duration-300 ${isActive ? 'text-primary' : 'text-muted group-hover:text-foreground'}`}>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`relative z-10 text-[10px] font-medium leading-none transition-colors duration-300 ${isActive ? 'text-primary' : 'text-muted'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
