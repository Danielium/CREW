"use client";

import { useState, useEffect } from "react";
import { Loader2, Edit2, Trash2, Calendar, MapPin, Activity, Clock, User, KeyRound, Lock, Check, Plus, Footprints, Play, X, Share } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { globalCache } from "@/lib/cache";

export default function FeedEvents({ userData }: { userData: any }) {
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (globalCache.events) {
      setEvents(globalCache.events);
      setIsLoading(false);
      return;
    }

    fetch('/api/events', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data.events) {
          setEvents(data.events);
          globalCache.events = data.events;
        }
        setIsLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setIsLoading(false); // BUG-039 fix: disable spinner on error
      });
  }, []);

  const canCreate = userData?.clubMembers?.some((m: any) => m.status === "ACTIVE" && (m.role === "FOUNDER" || m.role === "OFFICER" || m.role === "PACER"));

  const handleDelete = async (id: string) => {
    if (confirm("Удалить это событие навсегда?")) {
      try {
        const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
        if (res.ok) {
          const newEvents = events.filter(e => e.id !== id);
          setEvents(newEvents);
          globalCache.events = newEvents;
        } else {
          const data = await res.json();
          alert(data.error || "Ошибка при удалении события");
        }
      } catch (e) {
        alert("Ошибка сети");
      }
    }
  };

  const handleJoinEvent = async (id: string) => {
    try {
      const res = await fetch(`/api/events/${id}/join`, { method: "POST" });
      if (res.ok) {
        fetch('/api/events', { cache: 'no-store' })
          .then(r => r.json())
          .then(data => {
            if (data.events) {
              setEvents(data.events);
              globalCache.events = data.events;
            }
          });
      }
    } catch (e) {
      console.error(e);
    }
  };


  if (isLoading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary" size={32} /></div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="px-4 flex justify-between items-center">
        <h2 className="text-xl font-black uppercase tracking-tight">Открытые события</h2>
        {canCreate && (
          <Link href="/events/create" className="px-3 py-1.5 rounded-full bg-primary text-black font-bold text-[10px] uppercase tracking-widest shadow-[0_0_10px_rgba(204,255,0,0.4)]">
            Создать
          </Link>
        )}
      </div>
      
      <div className="px-4 flex flex-col gap-4">
        {events.length === 0 && (
          <div className="text-center p-8 bg-card rounded-3xl border border-border text-muted">
            Пока нет запланированных событий.
          </div>
        )}
        {events.map((ev) => {
          let paces: string[] = [];
          try { paces = JSON.parse(ev.pace || "[]"); } catch (e) { paces = ev.pace ? [ev.pace] : []; }
          if (!Array.isArray(paces)) paces = [ev.pace];

          let paceDisplay = "Любой";
          if (paces.length === 1) {
            paceDisplay = paces[0];
          } else if (paces.length > 1) {
            const hasFree = paces.includes("Свободный");
            const nums = paces.filter(p => p !== "Свободный").sort();
            if (nums.length > 0) {
              paceDisplay = nums.length > 1 ? `${nums[0]}-${nums[nums.length-1]}` : nums[0];
            } else {
              paceDisplay = "Свободный";
            }
          }

          const isCreator = ev.creatorId === userData?.id;
          const isClubAdmin = userData?.clubMembers?.some((m: any) => m.clubId === ev.clubId && m.status === 'ACTIVE' && (m.role === 'FOUNDER' || m.role === 'OFFICER'));
          const canManage = isCreator || isClubAdmin;
          const isAttending = ev.attendees?.some((a: any) => a.id === userData?.id);
          const timeDiff = new Date(ev.date).getTime() - Date.now();
          const isPast = timeDiff < -60 * 60 * 1000; // Завершено, если прошло больше часа с начала
          const canStartRun = Math.abs(timeDiff) <= 60 * 60 * 1000; // Окрестность +- 1 час от начала

          return (
          <div key={ev.id} className="w-full rounded-[28px] bg-[#1a1a1c] border border-border overflow-hidden flex flex-col relative shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
            
              {/* Top Image Section */}
            <div 
              className="relative w-full h-[260px] cursor-pointer" 
              onClick={() => router.push(`/events/${ev.id}`)}
            >
              <img src={ev.image || "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?q=80&w=2940&auto=format&fit=crop"} alt={ev.title} className="absolute inset-0 w-full h-full object-cover" />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#000000]/95 via-[#000000]/60 to-transparent"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1c] via-[#1a1a1c]/20 to-black/40"></div>
              
              {/* Management tools in top right */}
              <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
                {canManage && (
                  <>
                    <button 
                      onClick={(e) => { e.stopPropagation(); router.push(`/events/${ev.id}/edit`); }} 
                      className="p-2 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white hover:text-primary transition-colors shadow-lg"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(ev.id); }} 
                      className="p-2 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white hover:text-red-500 transition-colors shadow-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>

              {/* Content overlay */}
              <div className="absolute inset-0 p-5 flex flex-col justify-between z-10">
                {/* Badge */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 bg-black/40 backdrop-blur-md w-fit">
                  <div className={`w-2 h-2 rounded-full ${isPast ? 'bg-muted' : 'bg-primary'}`}></div>
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${isPast ? 'text-muted' : 'text-primary'}`}>
                    {isPast ? "ЗАВЕРШЕНО" : (ev.club?.name ? "СОБЫТИЕ КЛУБА" : "ОТКРЫТОЕ СОБЫТИЕ")}
                  </span>
                </div>

                {/* Title & Info */}
                <div className="flex flex-col mt-auto">
                  <h3 className="text-4xl italic font-black uppercase tracking-tighter text-white leading-[1.05] mb-3 pr-12">{ev.title}</h3>
                  <div className="w-16 h-1.5 bg-primary mb-4 rounded-full"></div>
                  
                  <div className="flex flex-col gap-1.5 text-white/90 text-[14px] font-medium tracking-wide">
                    <div className="flex items-center gap-2.5">
                      <Calendar size={18} className="text-white/70" />
                      <span>{new Date(ev.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', weekday: 'short' })} • {new Date(ev.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <MapPin size={18} className="text-white/70" />
                      <span className="truncate pr-4">{ev.location}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Bottom Section */}
            <div className="bg-[#1a1a1c] flex flex-col relative z-20">
              
              {/* 2 Columns */}
              <div className="grid grid-cols-2 divide-x divide-white/10 py-5 w-full">
                {/* Distance */}
                <div className="flex justify-start items-center pl-6 sm:pl-10">
                  <div className="flex items-center gap-2.5">
                    <Activity size={20} className="text-primary flex-shrink-0" />
                    <div className="flex flex-col">
                      <div className="flex items-baseline gap-1">
                        <span className="text-[16px] font-black text-white leading-none">{ev.distance || "-"}</span>
                      </div>
                      <span className="text-[11px] text-white/50 font-medium mt-1">Дистанция{ev.distance ? ", км" : ""}</span>
                    </div>
                  </div>
                </div>

                {/* Pace */}
                <div className="flex justify-start items-center pl-6 sm:pl-10 overflow-hidden">
                  <div className="flex items-center gap-2.5">
                    <Clock size={20} className="text-primary flex-shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-baseline gap-1 shrink-0">
                        <span className="text-[16px] font-black text-white leading-none tracking-tight whitespace-nowrap shrink-0">
                          {paceDisplay}
                        </span>
                      </div>
                      <span className="text-[11px] text-white/50 font-medium mt-1">Темп{paces.length > 0 ? ", мин/км" : ""}</span>
                    </div>
                  </div>
                </div>
              </div>


              {/* Avatars */}
              <div className="p-5 pt-2 pb-5 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex -space-x-3">
                    {ev.attendees?.slice(0, 4).map((user: any) => (
                      user.image ? (
                        <img key={user.id} src={user.image} className="w-11 h-11 rounded-full border-2 border-[#1a1a1c] relative z-10 object-cover bg-muted" />
                      ) : (
                        <div key={user.id} className="w-11 h-11 rounded-full border-2 border-[#1a1a1c] relative z-10 bg-muted flex items-center justify-center">
                          <User size={16} className="text-foreground" />
                        </div>
                      )
                    ))}
                    {ev.attendees?.length > 4 && (
                      <div className="w-11 h-11 rounded-full border-2 border-[#1a1a1c] bg-white/5 flex items-center justify-center text-[12px] font-bold text-white relative z-0">
                        +{ev.attendees.length - 4}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2 relative z-10">
                  <button 
                    onClick={(e) => { 
                      e.preventDefault(); 
                      e.stopPropagation(); 
                      const botAppUrl = process.env.NEXT_PUBLIC_BOT_APP_URL;
                      const link = botAppUrl ? `${botAppUrl}?startapp=focus_${ev.id}` : `${window.location.origin}/?focus=${ev.id}`;
                      navigator.clipboard.writeText(link);
                      alert("Ссылка скопирована!");
                    }} 
                    className="p-2 rounded-full bg-black border border-white/10 text-white/70 hover:bg-black/80 hover:text-white transition-colors" title="Поделиться"
                  >
                    <Share size={16} />
                  </button>
                  {!isPast && (
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleJoinEvent(ev.id); }} className="p-2 rounded-full bg-black border border-primary/20 text-primary hover:bg-black/80 hover:border-primary/50 transition-colors" title={isAttending ? "Отменить участие" : "Присоединиться"}>
                      {isAttending ? <X size={16} /> : <Plus size={16} />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )})}
      </div>
    </div>
  );
}
