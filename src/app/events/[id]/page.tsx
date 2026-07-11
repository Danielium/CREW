"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, MapPin, Calendar, Clock, Trash2, ChevronDown, ChevronUp, Loader2, User } from "lucide-react";
import dynamic from 'next/dynamic';

const RunRouteMap = dynamic(() => import('@/components/RunRouteMap'), {
  ssr: false,
  loading: () => <div className="w-full h-[200px] bg-muted/50 rounded-xl flex items-center justify-center animate-pulse">Загрузка карты...</div>
});

export default function EventDetailsPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { data: session, status } = useSession();
  
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchEvent();
    }
  }, [id, status]);

  const fetchEvent = async () => {
    try {
      const res = await fetch(`/api/events/${id}`);
      const data = await res.json();
      if (data.event) {
        setEvent(data.event);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleKick = async (userId: string) => {
    if (!confirm("Вы уверены, что хотите исключить этого участника из забега?")) return;
    try {
      const res = await fetch(`/api/events/${id}/kick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      if (res.ok) {
        const { globalCache } = await import("@/lib/cache");
        fetch('/api/events').then(r => r.json()).then(d => {
          if (d.events) globalCache.events = d.events;
        }).catch(() => {});
        setEvent((prev: any) => ({
          ...prev,
          attendees: prev.attendees.filter((u: any) => u.id !== userId)
        }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={40} /></div>;
  }

  if (!event) {
    return <div className="min-h-screen flex items-center justify-center">Событие не найдено</div>;
  }

  const currentUserId = (session?.user as any)?.id;
  const isCreator = event.creatorId === currentUserId;
  const isClubAdmin = event.club?.members?.some((m: any) => m.userId === currentUserId && (m.role === 'FOUNDER' || m.role === 'OFFICER'));
  const canManage = isCreator || isClubAdmin;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="relative h-64 w-full bg-background overflow-hidden">
        {event.image ? (
          <img src={event.image} alt={event.title} className="absolute inset-0 w-full h-full object-cover scale-[1.02]" />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-20">
            <MapPin size={80} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
        <div className="absolute inset-x-0 bottom-[-2px] h-[4px] bg-background"></div>
        {/* Native back button used here */}
        
        <div className="absolute bottom-0 left-0 w-full p-6">
          <h1 className="text-3xl font-black uppercase tracking-tight leading-none mb-2 text-white">{event.title}</h1>
          <div className="flex items-center gap-4 text-sm font-bold text-primary tracking-wider uppercase">
            <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(event.date).toLocaleDateString('ru-RU')}</span>
            <span className="flex items-center gap-1"><Clock size={14} /> {new Date(event.date).toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}</span>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="mb-10 flex flex-col gap-6">
          <div>
            <div className="flex items-center gap-2 text-muted mb-1 uppercase text-xs font-bold tracking-wider">
              <MapPin size={14} /> Локация
            </div>
            <p className="font-medium text-base">{event.location}</p>
          </div>
          
          {event.description && (
            <div>
              <p className="text-base text-white/90 whitespace-pre-wrap leading-relaxed">{event.description}</p>
            </div>
          )}

          {event.routeData && (
            <div>
              <div className="flex items-center gap-2 text-muted mb-3 uppercase text-xs font-bold tracking-wider">
                <MapPin size={14} /> Маршрут
              </div>
              <div className="h-[250px] w-full rounded-[24px] overflow-hidden border border-border/50 shadow-2xl relative z-0">
                <RunRouteMap routeData={event.routeData} />
              </div>
            </div>
          )}
        </div>

        <h2 className="text-xl font-black uppercase tracking-tight mb-4">Участники ({event.attendees?.length || 0})</h2>
        
        <div className="flex flex-col gap-3">
          {event.attendees?.map((user: any) => {
            const run = event.runs?.find((r: any) => r.userId === user.id);
            const isExpanded = expandedUser === user.id;
            const splits = run?.splits ? JSON.parse(run.splits) : null;
            
            return (
              <div key={user.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer active:bg-white/5 transition-colors"
                  onClick={() => splits && setExpandedUser(isExpanded ? null : user.id)}
                >
                  <div className="flex items-center gap-3">
                    {user.image ? (
                      <img src={user.image} alt={user.name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <User size={16} />
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-sm">{user.name}</div>
                      {run ? (
                        <div className="text-xs text-primary font-mono mt-0.5">{run.distance.toFixed(2)} км • {Math.floor(run.avgPace)}:{(Math.floor((run.avgPace % 1) * 60)).toString().padStart(2, '0')} /км</div>
                      ) : (
                        <div className="text-xs text-muted mt-0.5">
                          Участник
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {canManage && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleKick(user.id); }}
                        className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500/20"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    {splits && (
                      <div className="text-muted">
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    )}
                  </div>
                </div>

                {isExpanded && splits && (
                  <div className="px-4 pb-4 pt-1 border-t border-white/5 bg-black/20">
                    <div className="text-[10px] text-muted uppercase font-bold tracking-widest mb-3 mt-2">Сплиты по километрам</div>
                    <div className="flex flex-col gap-2">
                      {splits.map((timeSec: number, idx: number) => {
                        const mins = Math.floor(timeSec / 60);
                        const secs = Math.floor(timeSec % 60);
                        const isLast = idx === splits.length - 1;
                        const distLabel = isLast && run.distance % 1 !== 0 
                          ? `${idx}-${run.distance.toFixed(2)} км` 
                          : `${idx + 1} км`;
                        
                        return (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-white/60">{distLabel}</span>
                            <span className="font-mono">{mins}:{secs.toString().padStart(2, '0')}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          
          {(!event.attendees || event.attendees.length === 0) && (
            <div className="text-center p-8 bg-card border border-border rounded-2xl text-muted text-sm">
              Пока нет участников
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
