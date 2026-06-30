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
          const [feedRes, userRes, clubsRes, eventsRes] = await Promise.all([
            fetch('/api/feed', { cache: 'no-store' }),
            fetch(`/api/users?userId=${(session.user as any).id}`),
            fetch('/api/clubs', { cache: 'no-store' }),
            fetch('/api/events', { cache: 'no-store' })
          ]);
          
          if (feedRes.ok) {
            const feedData = await feedRes.json();
            globalCache.feedPosts = feedData.posts;
          }
          let loadedUser = null;
          if (userRes.ok) {
            const userData = await userRes.json();
            globalCache.userData = userData.user;
            loadedUser = userData.user;
          }
          if (clubsRes.ok) {
            const clubsData = await clubsRes.json();
            globalCache.clubs = clubsData.clubs;
          }
          if (eventsRes.ok) {
            const eventsData = await eventsRes.json();
            globalCache.events = eventsData.events;
          }

          // Fetch leaderboard if user is in a club
          if (loadedUser?.clubMembers?.length > 0) {
            const clubId = loadedUser.clubMembers[0].clubId;
            const lbRes = await fetch(`/api/leaderboard?clubId=${clubId}`, { cache: 'no-store' });
            if (lbRes.ok) {
              const lbData = await lbRes.json();
              globalCache.leaderboard[clubId] = lbData.users;
            }
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
        <img 
          src="/logo.png" 
          alt="CREW Logo" 
          className="w-28 h-28 animate-pulse drop-shadow-[0_0_40px_rgba(204,255,0,0.3)] object-contain" 
        />
        <div className="mt-8 flex flex-col items-center gap-2">
          <h1 className="text-xl font-black tracking-[0.2em] uppercase animate-pulse text-foreground">CREW</h1>
          <p className="text-muted text-[10px] font-bold tracking-[0.3em] uppercase animate-pulse opacity-50">Загрузка...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
