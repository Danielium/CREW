"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, User, Target, Trash2, MoreVertical } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";

import { globalCache } from "@/lib/cache";

export default function Leaderboard({ clubId }: { clubId?: string }) {
  const { data: session } = useSession();
  const cacheKey = clubId || 'global';
  const [users, setUsers] = useState<any[]>(globalCache.leaderboard[cacheKey] || []);
  const [isLoading, setIsLoading] = useState(!globalCache.leaderboard[cacheKey]);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
        globalCache.clubs = null; // Next time club page is opened, it refetches
        // Update local state without reloading
        const newRole = currentRole === "PACER" ? "MEMBER" : "PACER";
        setUsers(prev => {
          const newUsers = prev.map(u => u.id === userId ? { ...u, role: newRole } : u);
          if (globalCache.leaderboard[cacheKey]) {
            globalCache.leaderboard[cacheKey] = newUsers;
          }
          return newUsers;
        });
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
        // Update local state without reloading
        setUsers(prev => {
          const newUsers = prev.filter(u => u.id !== userId);
          if (globalCache.leaderboard[cacheKey]) {
            globalCache.leaderboard[cacheKey] = newUsers;
          }
          return newUsers;
        });
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
                  <div className="flex items-center gap-3 relative">
                    <span className="text-xl font-black italic tracking-tighter">{user.totalDistance.toFixed(1)}<span className="ml-1.5 text-[10px] font-black not-italic tracking-normal opacity-80 uppercase">км</span></span>
                    {isFounder && !isMe && (
                      <div className="relative" onClick={(e) => e.preventDefault()} ref={openMenuId === user.id ? menuRef : null}>
                        <button 
                          onClick={(e) => { 
                            e.preventDefault(); 
                            setOpenMenuId(openMenuId === user.id ? null : user.id); 
                          }} 
                          className="p-1 text-muted hover:text-white transition-colors"
                        >
                          {processingIds.has(user.id) ? <Loader2 size={18} className="animate-spin text-primary" /> : <MoreVertical size={18} />}
                        </button>
                        
                        {openMenuId === user.id && (
                          <div className="absolute right-0 top-full mt-1 w-48 bg-[#1a1a1c] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col p-1">
                            <button 
                              onClick={(e) => { 
                                e.preventDefault(); 
                                handleToggleRole(user.id, user.role || "MEMBER");
                                setOpenMenuId(null);
                              }} 
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-white/5 rounded-lg transition-colors text-left"
                            >
                              <Target size={14} className="text-blue-500" />
                              {user.role === "PACER" ? "Снять пейсера" : "Сделать пейсером"}
                            </button>
                            <button 
                              onClick={(e) => { 
                                e.preventDefault(); 
                                handleRemoveMember(user.id);
                                setOpenMenuId(null);
                              }} 
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-white/5 rounded-lg transition-colors text-left text-red-400"
                            >
                              <Trash2 size={14} />
                              Удалить участника
                            </button>
                          </div>
                        )}
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
