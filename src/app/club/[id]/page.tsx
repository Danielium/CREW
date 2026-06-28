"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Flag, Users, Shield, Loader2, Star, Target, Map, Trash2 } from "lucide-react";
import Link from "next/link";
import ClubBadge from "@/components/ClubBadge";

export default function ClubProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  
  const [club, setClub] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    fetchClub();
  }, [id]);

  const fetchClub = async () => {
    try {
      const res = await fetch(`/api/clubs/${id}`);
      const data = await res.json();
      if (data.club) setClub(data.club);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!session) return router.push('/login');
    setIsJoining(true);
    try {
      const res = await fetch(`/api/clubs/${id}`, { method: "POST" });
      const data = await res.json();
      if (data.member) {
        fetchClub(); // refresh
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsJoining(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Вы уверены, что хотите удалить этого участника из клуба?")) return;
    try {
      const res = await fetch(`/api/clubs/${id}/members/${userId}`, { method: "DELETE" });
      if (res.ok) {
        fetchClub(); // refresh
      } else {
        alert("Ошибка при удалении участника.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLeaveClub = async () => {
    if (!confirm("Вы уверены, что хотите покинуть клуб?")) return;
    try {
      const res = await fetch(`/api/clubs/${id}/leave`, { method: "DELETE" });
      if (res.ok) {
        router.push("/");
      } else {
        const data = await res.json();
        alert(data.error || "Ошибка при выходе из клуба.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDisbandClub = async () => {
    if (!confirm("Вы уверены, что хотите распустить клуб? Это действие нельзя отменить!")) return;
    try {
      const res = await fetch(`/api/clubs/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/");
      } else {
        alert("Ошибка при распускании клуба.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={40}/></div>;
  if (!club) return <div className="p-8 text-center text-muted">Клуб не найден</div>;

  const myMembership = session ? club.members.find((m: any) => m.userId === (session.user as any).id) : null;
  const isFounder = myMembership?.role === "FOUNDER";
  const isActiveMember = myMembership?.status === "ACTIVE";
  const isPending = myMembership?.status === "PENDING";
  
  const tags = JSON.parse(club.tags || "[]");

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground relative z-10">
      
      {/* HEADER BANNER */}
      <div className="h-64 bg-card relative flex flex-col justify-end p-6 border-b border-border">
        {/* Native back button used here via TelegramBackButton */}
        
        {isFounder && (
          <Link href={`/club/${id}/admin`} className="absolute top-safe right-4 px-4 h-10 rounded-full bg-primary text-black font-bold flex items-center justify-center z-20 text-xs uppercase tracking-wider">
            Управление
          </Link>
        )}

        {/* Diagonal Pattern Overlay */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), repeating-linear-gradient(45deg, #000 25%, #222 25%, #222 75%, #000 75%, #000)', backgroundPosition: '0 0, 10px 10px', backgroundSize: '20px 20px' }}></div>
        
        <div className="relative z-10">
          <div className="flex flex-wrap gap-2 mb-3">
            {tags.map((tag: string) => (
              <span key={tag} className="px-2 py-1 bg-background text-[10px] font-bold uppercase tracking-wider rounded-md text-primary">
                #{tag}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-4 mb-2">
            {(() => {
              try {
                const logo = JSON.parse(club.logoConfig);
                if (logo && logo.shape) return <div className="flex-shrink-0 drop-shadow-xl"><ClubBadge {...logo} size={64} /></div>;
              } catch(e) {}
              return null;
            })()}
            <h1 className={`${club.name.length > 12 ? 'text-2xl' : 'text-4xl'} font-black uppercase tracking-tight leading-none break-words`}>{club.name}</h1>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted font-medium uppercase tracking-wider">
            <span className="flex items-center gap-1"><Users size={14}/> {club.members.filter((m: any)=>m.status==="ACTIVE").length} Атлетов</span>
            <span className="flex items-center gap-1"><Map size={14}/> {Math.floor(club.totalClubDistance)} км пробега</span>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="p-6 flex flex-col gap-8 pb-24">
        
        {/* About */}
        <div>
          <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Манифест</h3>
          <p className="text-sm leading-relaxed">{club.description || "Без описания"}</p>
        </div>

        {/* Join CTA for Non-members */}
        {!isActiveMember && (
          <div className="bg-card p-6 rounded-3xl border border-border flex flex-col items-center text-center shadow-lg">
            <Shield size={32} className="text-primary mb-3" />
            <h3 className="font-black uppercase tracking-wider mb-2">Стать частью клуба</h3>
            <p className="text-xs text-muted mb-6">
              {club.joinType === "OPEN" ? "Свободный вход для всех желающих." : club.joinType === "APPLICATION" ? "Заявки рассматриваются фаундерами. Докажи, что ты достоин." : "Только по приглашению."}
            </p>
            
            {club.joinType !== "INVITE_ONLY" && !isPending && (
              <button 
                onClick={handleJoin}
                disabled={isJoining}
                className="w-full py-4 rounded-2xl bg-primary text-black font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-[#b3e600] transition-all"
              >
                {isJoining ? <Loader2 className="animate-spin" size={20} /> : (club.joinType === "OPEN" ? "Вступить" : "Подать заявку")}
              </button>
            )}

            {isPending && (
              <div className="w-full py-4 rounded-2xl bg-background border border-border text-muted font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2">
                Заявка на рассмотрении
              </div>
            )}
          </div>
        )}

        {/* Club Events Preview */}
        {club.events && club.events.length > 0 && (
          <div>
            <div className="flex justify-between items-end mb-4">
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Ближайшие события</h3>
            </div>
            <div className="flex flex-col gap-3">
              {club.events.map((ev: any) => (
                <Link href={`/events/${ev.id}`} key={ev.id}>
                  <div className="bg-[#1a1a1c] border border-border rounded-2xl overflow-hidden flex flex-col hover:border-primary transition-colors">
                    <div className="h-24 relative w-full">
                      <img src={ev.image || "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?q=80&w=1000&auto=format&fit=crop"} className="absolute inset-0 w-full h-full object-cover opacity-50" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1c] to-transparent"></div>
                      <div className="absolute bottom-2 left-3 right-3 flex justify-between items-end">
                        <h4 className="font-black uppercase tracking-tight text-lg leading-none z-10 text-white">{ev.title}</h4>
                      </div>
                    </div>
                    <div className="p-3 flex justify-between items-center text-xs text-muted font-medium">
                      <span>{new Date(ev.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} • {new Date(ev.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                      {ev.distance && <span className="font-bold text-primary">{ev.distance} КМ</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Members Leaderboard Preview */}
        {isActiveMember && (
          <div>
            <div className="flex justify-between items-end mb-4">
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Ростер Клуба</h3>
            </div>
            
            <div className="flex flex-col gap-2">
              {club.members.filter((m: any)=>m.status==="ACTIVE").slice(0, 5).map((member: any, i: number) => (
                <div key={member.id} className="flex items-center justify-between p-3 bg-card border border-border rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 font-black text-muted bg-background rounded-full flex items-center justify-center text-xs border border-border">
                      {i + 1}
                    </div>
                    <div>
                      <div className="font-bold text-sm flex items-center gap-2">
                        {member.user.name || "Аноним"}
                        {member.role === "FOUNDER" && <Star size={12} className="text-primary" fill="currentColor" />}
                        {member.role === "PACER" && <Target size={12} className="text-blue-400" />}
                      </div>
                      <div className="text-[10px] text-muted uppercase tracking-wider">{member.role}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="font-bold font-mono text-right">{member.user.totalDistance.toFixed(1)} <span className="text-[10px] text-muted">КМ</span></div>
                    {isFounder && member.userId !== (session?.user as any)?.id && (
                      <button onClick={() => handleRemoveMember(member.userId)} className="p-2 text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors ml-2 border border-red-500/20 rounded-xl">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Danger Zone */}
        {isActiveMember && (
          <div className="mt-8 pt-8 border-t border-border">
            {isFounder ? (
              <button onClick={handleDisbandClub} className="w-full py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 font-bold uppercase tracking-wider hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2">
                <Trash2 size={18} /> Распустить клуб
              </button>
            ) : (
              <button onClick={handleLeaveClub} className="w-full py-4 rounded-2xl bg-card border border-border text-muted font-bold uppercase tracking-wider hover:bg-border transition-colors flex items-center justify-center gap-2">
                Выйти из клуба
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
