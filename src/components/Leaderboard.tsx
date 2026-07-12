"use client";

import { useState, useEffect } from "react";
import { Loader2, User } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";

import { globalCache } from "@/lib/cache";

export default function Leaderboard({ clubId }: { clubId?: string }) {
  const { data: session } = useSession();
  const cacheKey = clubId || 'global';
  const [users, setUsers] = useState<any[]>(globalCache.leaderboard[cacheKey] || []);
  const [isLoading, setIsLoading] = useState(!globalCache.leaderboard[cacheKey]);

  useEffect(() => {
    if (globalCache.leaderboard[cacheKey]) {
      setUsers(globalCache.leaderboard[cacheKey]);
      setIsLoading(false);
      return;
    }

    fetch(`/api/leaderboard${clubId ? `?clubId=${clubId}` : ''}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data.users) {
          setUsers(data.users);
          globalCache.leaderboard[cacheKey] = data.users;
        }
        setIsLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setIsLoading(false); // disable spinner on error
      });
  }, [clubId]);

  if (isLoading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary" size={32} /></div>;

  return (
    <div className="flex flex-col px-4">
      <h2 className="text-xl font-black uppercase tracking-tight mb-4">{clubId ? "Атлеты Клуба" : "Индивидуальный Топ"}</h2>
      <div className="flex flex-col gap-2">
        {users.map((user, index) => {
          const isMe = user.id === (session?.user as any)?.id;
          return (
            <Link href={isMe ? '/profile' : `/users/${user.id}`} key={user.id}>
              <div className={`flex items-center justify-between p-3.5 rounded-[16px] ${isMe ? 'bg-primary text-black font-semibold' : 'bg-card border border-border hover:bg-muted/50 text-foreground transition-colors'}`}>
                  <div className="flex items-center gap-4">
                      <span className={`w-5 text-center text-sm ${isMe ? 'font-bold' : 'text-muted'}`}>{index + 1}</span>
                      {user.image ? (
                          <img src={user.image} className="w-10 h-10 rounded-full object-cover border border-background/20 bg-muted" alt={user.name} />
                      ) : (
                          <div className="w-10 h-10 rounded-full border border-background/20 bg-muted flex items-center justify-center">
                            <User size={16} className={isMe ? "text-black" : "text-foreground"} />
                          </div>
                      )}
                      <span className="font-medium text-sm truncate max-w-[120px]">{user.name}</span>
                  </div>
                  <span className="text-xl font-black italic tracking-tighter">{user.totalDistance.toFixed(1)} <span className="text-[10px] font-bold not-italic tracking-normal opacity-80 uppercase">км</span></span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
