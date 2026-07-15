"use client";

import { useState, useEffect } from "react";
import { Loader2, User, Target, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";

import { globalCache } from "@/lib/cache";

export default function Leaderboard({ clubId }: { clubId?: string }) {
  const { data: session } = useSession();
  const cacheKey = clubId || 'global';
  const [users, setUsers] = useState<any[]>(globalCache.leaderboard[cacheKey] || []);
  const [isLoading, setIsLoading] = useState(!globalCache.leaderboard[cacheKey]);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const isFounder = clubId && globalCache.userData?.clubMembers?.some((m: any) => m.clubId === clubId && m.role === "FOUNDER");

  const handleToggleRole = async (userId: string, currentRole: string) => {
    if (!confirm(currentRole === "PACER" ? "Убрать статус пейсера?" : "Назначить пейсером?")) return;
    setProcessingIds((prev) => new Set(prev).add(userId));
    try {
      const res = await fetch(`/api/clubs/${clubId}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setRole", role: currentRole === "PACER" ? "MEMBER" : "PACER" })
      });
      if (res.ok) {
        globalCache.clubs = null;
        // The page needs to reload or refetch leaderboard
        window.location.reload();
      } else {
        alert("Ошибка при изменении роли.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Вы уверены, что хотите удалить этого участника из клуба?")) return;
    setProcessingIds((prev) => new Set(prev).add(userId));
    try {
      const res = await fetch(`/api/clubs/${clubId}/members/${userId}`, { method: "DELETE" });
      if (res.ok) {
        globalCache.clubs = null;
        globalCache.leaderboard[cacheKey] = null; // force refetch
        window.location.reload();
      } else {
        alert("Ошибка при удалении участника.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

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
                      <span className={`w-6 text-center text-2xl font-black italic tracking-tighter ${isMe ? '' : 'text-muted/70'}`}>{index + 1}</span>
                      {user.image ? (
                          <img src={user.image} className="w-10 h-10 rounded-full object-cover border border-background/20 bg-muted" alt={user.name} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}&background=random&color=fff`; }} />
                      ) : (
                          <div className="w-10 h-10 rounded-full border border-background/20 bg-muted flex items-center justify-center">
                            <User size={16} className={isMe ? "text-black" : "text-foreground"} />
                          </div>
                      )}
                      <div className="flex flex-col">
                        <span className="font-bold text-sm truncate max-w-[120px]">{user.name}</span>
                        {user.role && (
                          <span className="text-[10px] text-muted uppercase tracking-wider">{user.role}</span>
                        )}
                      </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-black italic tracking-tighter">{user.totalDistance.toFixed(1)}<span className="ml-1.5 text-[10px] font-black not-italic tracking-normal opacity-80 uppercase">км</span></span>
                    {isFounder && !isMe && (
                      <div className="flex gap-1" onClick={(e) => e.preventDefault()}>
                        <button 
                          onClick={(e) => { e.preventDefault(); handleToggleRole(user.id, user.role || "MEMBER"); }} 
                          disabled={processingIds.has(user.id)}
                          className="p-2 text-blue-500 hover:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors border border-blue-500/20 rounded-xl disabled:opacity-50" 
                          title={user.role === "PACER" ? "Убрать пейсера" : "Сделать пейсером"}
                        >
                          {processingIds.has(user.id) ? <Loader2 size={14} className="animate-spin" /> : <Target size={14} />}
                        </button>
                        <button 
                          onClick={(e) => { e.preventDefault(); handleRemoveMember(user.id); }} 
                          disabled={processingIds.has(user.id)}
                          className="p-2 text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors border border-red-500/20 rounded-xl disabled:opacity-50" 
                          title="Удалить участника"
                        >
                          {processingIds.has(user.id) ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    )}
                  </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
