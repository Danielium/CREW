"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { globalCache } from "@/lib/cache";

export function SplashLoader({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [isReady, setIsReady] = useState(globalCache.isInitialLoadComplete);

  useEffect(() => {
    if (globalCache.isInitialLoadComplete) return;

    // If not logged in, we don't need to load user/feed data, just proceed
    if (status === "unauthenticated") {
      setIsReady(true);
      return;
    }

    if (status === "authenticated" && session?.user) {
      const loadAll = async () => {
        try {
          const [feedRes, userRes] = await Promise.all([
            fetch('/api/feed', { cache: 'no-store' }),
            fetch(`/api/users?userId=${(session.user as any).id}`)
          ]);
          
          if (feedRes.ok) {
            const feedData = await feedRes.json();
            globalCache.feedPosts = feedData.posts;
          }
          if (userRes.ok) {
            const userData = await userRes.json();
            globalCache.userData = userData.user;
          }
        } catch (e) {
          console.error("Failed to load initial data", e);
        } finally {
          globalCache.isInitialLoadComplete = true;
          // Adding a small minimum delay so the splash screen doesn't flicker uncomfortably
          setTimeout(() => setIsReady(true), 300);
        }
      };
      
      loadAll();
    }
  }, [session, status]);

  if (!isReady && status !== "unauthenticated") {
    return (
      <div className="flex-1 w-full h-[100dvh] flex flex-col items-center justify-center bg-background z-50 fixed inset-0 overflow-hidden">
        <div className="w-24 h-24 bg-primary flex items-center justify-center rounded-[24px] animate-pulse shadow-[0_0_40px_rgba(204,255,0,0.4)]">
          <span className="text-black font-black text-3xl tracking-tighter uppercase">CREW</span>
        </div>
        <p className="mt-8 text-muted text-sm font-bold tracking-[0.2em] uppercase animate-pulse">Загрузка...</p>
      </div>
    );
  }

  return <>{children}</>;
}
