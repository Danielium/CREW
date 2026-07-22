"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { Bell, User, Users, Search, ChevronRight, Trophy, Info, Loader2, Map, Flag, Crown, Edit2, Trash2, Calendar, Clock, Activity, BarChart2, MapPin, Plus, Check, QrCode, ScanLine, Shield, Star, Target, Copy, UserCheck, UserX, Key, ChevronLeft } from "lucide-react";
import Link from "next/link";
import ClubBadge from "@/components/ClubBadge";
import { globalCache } from "@/lib/cache";

export default function ClubProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  
  const [club, setClub] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editDescriptionValue, setEditDescriptionValue] = useState("");
  const [isSavingDescription, setIsSavingDescription] = useState(false);

  const fetchClub = async () => {
    try {
      const res = await fetch(`/api/clubs/${id}`);
      const data = await res.json();
      if (data.club) {
        setClub(data.club);
        setEditNameValue(data.club.name);
        setEditDescriptionValue(data.club.description || "");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClub();
  }, [id]);

  useEffect(() => {
    // Check if we just returned from logo builder
    const savedConfig = localStorage.getItem("clubLogoConfig");
    if (savedConfig && id) {
      setIsUploadingLogo(true);
      try {
        const config = JSON.parse(savedConfig);
        fetch(`/api/clubs/${id}/logo`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logoConfig: JSON.stringify(config) })
        }).then(res => {
          if (res.ok) fetchClub();
        }).finally(() => {
          localStorage.removeItem("clubLogoConfig");
          setIsUploadingLogo(false);
        });
      } catch (e) {
        console.error(e);
        localStorage.removeItem("clubLogoConfig");
        setIsUploadingLogo(false);
      }
    }
  }, [id]);

  const handleJoin = async () => {
    if (!session) return router.push('/login');
    setIsJoining(true);
    try {
      const res = await fetch(`/api/clubs/${id}/join`, { method: "POST" });
      if (res.ok) {
        globalCache.clubs = null;
        fetchClub();
      } else {
        const data = await res.json();
        alert(data.error || "Ошибка при вступлении в клуб");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsJoining(false);
    }
  };

  const handleSaveName = async () => {
    if (!editNameValue.trim() || editNameValue === club.name) {
      setIsEditingName(false);
      return;
    }
    setIsSavingName(true);
    try {
      const res = await fetch(`/api/clubs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editNameValue.trim() })
      });
      if (res.ok) {
        setClub({ ...club, name: editNameValue.trim() });
        setIsEditingName(false);
      } else {
        alert("Ошибка при сохранении названия");
      }
    } catch (e) {
      console.error(e);
      alert("Сетевая ошибка");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSaveDescription = async () => {
    const trimmed = editDescriptionValue.trim();
    if (trimmed === club.description) {
      setIsEditingDescription(false);
      return;
    }
    setIsSavingDescription(true);
    try {
      const res = await fetch(`/api/clubs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: trimmed })
      });
      if (res.ok) {
        setClub({ ...club, description: trimmed });
        setIsEditingDescription(false);
      } else {
        alert("Ошибка при сохранении описания");
      }
    } catch (e) {
      console.error(e);
      alert("Сетевая ошибка");
    } finally {
      setIsSavingDescription(false);
    }
  };

  const copyInviteCode = async () => {
    if (!club?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(club.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement("textarea");
      el.value = club.inviteCode;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleMemberAction = async (userId: string, action: "approve" | "reject") => {
    setProcessingIds((prev) => new Set(prev).add(userId));
    try {
      const res = await fetch(`/api/clubs/${id}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        fetchClub(); // refresh
      } else {
        const data = await res.json();
        alert(data.error || "Ошибка");
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



  const handleLeaveClub = async () => {
    if (!confirm("Вы уверены, что хотите покинуть клуб?")) return;
    try {
      const res = await fetch(`/api/clubs/${id}/leave`, { method: "DELETE" });
      if (res.ok) {
        globalCache.clubs = null;
        globalCache.userData = null;
        fetch('/api/events').then(r => r.json()).then(d => {
          if (d.events) globalCache.events = d.events;
        }).catch(() => {});
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
        globalCache.clubs = null;
        globalCache.userData = null;
        fetch('/api/events').then(r => r.json()).then(d => {
          if (d.events) globalCache.events = d.events;
        }).catch(() => {});
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
      {/* Dynamic Background Glow */}
      <div className="fixed top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-primary/10 to-transparent -z-10 pointer-events-none" />
      <div className="fixed top-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-primary/20 rounded-full blur-[100px] -z-10 pointer-events-none opacity-50" />
      
      {/* HEADER BANNER */}
      <div className="h-64 bg-card/40 backdrop-blur-xl relative flex flex-col justify-end p-6 border-b border-white/5 shadow-lg">
        {/* Native back button used here via TelegramBackButton */}
        
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
          <div className="flex items-center gap-4 mb-4">
            {isFounder ? (
              <div className="relative group cursor-pointer shrink-0" onClick={() => {
                if (club?.logoConfig) localStorage.setItem("clubLogoConfig", club.logoConfig);
                router.push(`/club/logo-builder?admin=true&clubId=${id}`);
              }}>
                {(() => {
                  try {
                    const logo = JSON.parse(club.logoConfig);
                    return (
                      <div className={`relative ${isUploadingLogo ? 'opacity-50' : 'opacity-100'} transition-opacity drop-shadow-xl`}>
                        <ClubBadge {...logo} size={64} />
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-black shadow-lg">
                          {isUploadingLogo ? <Loader2 size={12} className="animate-spin" /> : <Edit2 size={12} />}
                        </div>
                      </div>
                    );
                  } catch(e) {}
                  return null;
                })()}
              </div>
            ) : (
              (() => {
                try {
                  const logo = JSON.parse(club.logoConfig);
                  if (logo && logo.shape) return <div className="flex-shrink-0 drop-shadow-xl"><ClubBadge {...logo} size={64} /></div>;
                } catch(e) {}
                return null;
              })()
            )}
            
            <div className="flex-1 min-w-0">
              {isFounder && isEditingName ? (
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={editNameValue} 
                    onChange={(e) => setEditNameValue(e.target.value)}
                    className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-xl font-black uppercase focus:outline-none focus:border-primary"
                    autoFocus
                  />
                  <button onClick={handleSaveName} disabled={isSavingName} className="p-2 bg-primary text-black rounded-xl shrink-0">
                    {isSavingName ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  </button>
                </div>
              ) : (
                <div className={`flex items-center gap-3 ${isFounder ? 'cursor-pointer group/name' : ''}`} onClick={() => isFounder && setIsEditingName(true)}>
                  <h1 className={`${club.name.length > 12 ? 'text-2xl' : 'text-4xl'} font-black uppercase tracking-tight leading-none break-words`}>{club.name}</h1>
                  {isFounder && (
                    <button className="text-muted group-hover/name:text-primary transition-colors">
                      <Edit2 size={16} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="p-6 flex flex-col gap-8 pb-24">
        
        {/* BIG DASHBOARD WIDGET */}
        <div className="flex gap-4">
          <div className="flex-1 bg-card/50 backdrop-blur-md rounded-3xl p-5 border border-white/5 flex flex-col justify-center shadow-lg">
            <span className="text-[10px] text-muted uppercase tracking-wider font-bold mb-1">Атлеты</span>
            <span className="text-3xl font-black uppercase tracking-tighter text-white leading-none">
              {club.members.filter((m: any)=>m.status==="ACTIVE").length}
            </span>
          </div>
          <div className="flex-1 bg-card/50 backdrop-blur-md rounded-3xl p-5 border border-white/5 flex flex-col justify-center shadow-lg">
            <span className="text-[10px] text-muted uppercase tracking-wider font-bold mb-1">Километраж</span>
            <span className="text-3xl font-black uppercase tracking-tighter text-primary leading-none flex items-baseline gap-1">
              {club.totalClubDistance.toFixed(1)} <span className="text-sm opacity-70 tracking-normal">КМ</span>
            </span>
          </div>
        </div>

        {/* About */}
        <div>
          <div className="flex items-center gap-2 mb-2 group/desc cursor-pointer" onClick={() => isFounder && setIsEditingDescription(true)}>
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Описание</h3>
            {isFounder && !isEditingDescription && (
              <button className="text-muted group-hover/desc:text-primary transition-colors">
                <Edit2 size={12} />
              </button>
            )}
          </div>
          {isEditingDescription && isFounder ? (
            <div className="flex flex-col gap-2">
              <textarea 
                value={editDescriptionValue} 
                onChange={(e) => setEditDescriptionValue(e.target.value)}
                className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:border-primary min-h-[100px] resize-none"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsEditingDescription(false)} className="px-4 py-2 bg-white/10 text-white rounded-xl text-xs font-bold uppercase">
                  Отмена
                </button>
                <button onClick={handleSaveDescription} disabled={isSavingDescription} className="px-4 py-2 bg-primary text-black rounded-xl flex items-center gap-2 text-xs font-bold uppercase">
                  {isSavingDescription ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Сохранить
                </button>
              </div>
            </div>
          ) : (
            <p className="text-lg font-medium leading-relaxed whitespace-pre-wrap" onClick={() => isFounder && setIsEditingDescription(true)}>
              {club.description || <span className="text-muted italic text-sm">Нет описания</span>}
            </p>
          )}
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

        {isFounder && (
          <div className="flex flex-col gap-8 mt-4 border-t border-white/10 pt-8">
            <div>
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-4">Администрирование</h3>
              
              {/* Invite Code Section */}
              <div className="bg-card/40 backdrop-blur-xl rounded-[28px] border border-white/5 p-6 shadow-xl relative overflow-hidden group mb-6">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[50px] -z-10 group-hover:bg-primary/20 transition-all duration-500" />
                
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                    <Key size={16} />
                  </div>
                  <h2 className="font-black uppercase tracking-wider text-sm">Код приглашения</h2>
                </div>
                <p className="text-xs text-muted mb-5 leading-relaxed">
                  Поделитесь этим кодом, чтобы бегуны могли вступить в клуб напрямую.
                </p>

                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-black/40 border border-white/10 rounded-2xl p-4 font-mono text-xl font-black tracking-[0.3em] text-center text-primary shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] select-all">
                    {club.inviteCode || "—"}
                  </div>
                  <button
                    onClick={copyInviteCode}
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all active:scale-95 ${
                      copied
                        ? "bg-green-500 text-white shadow-green-500/20"
                        : "bg-primary text-black shadow-primary/20 hover:bg-[#b3e600]"
                    }`}
                  >
                    {copied ? <Check size={24} /> : <Copy size={24} />}
                  </button>
                </div>
              </div>

              {/* Pending Applications */}
              {(club.joinType === "APPLICATION" || club.members.filter((m: any) => m.status === "PENDING").length > 0) && (
              <div className="bg-card/40 backdrop-blur-xl rounded-[28px] border border-white/5 p-6 shadow-xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <Users size={16} />
                    </div>
                    <h2 className="font-black uppercase tracking-wider text-sm">Заявки</h2>
                  </div>
                  {club.members.filter((m: any) => m.status === "PENDING").length > 0 && (
                    <span className="bg-primary text-black text-[10px] font-black px-3 py-1 rounded-full shadow-[0_0_15px_rgba(204,255,0,0.5)]">
                      {club.members.filter((m: any) => m.status === "PENDING").length} НОВЫХ
                    </span>
                  )}
                </div>

                {club.members.filter((m: any) => m.status === "PENDING").length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {club.members.filter((m: any) => m.status === "PENDING").map((member: any) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 pl-4 bg-black/20 border border-white/5 rounded-2xl hover:bg-black/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {member.user.image ? (
                            <img
                              src={member.user.image}
                              alt=""
                              className="w-10 h-10 rounded-full object-cover border border-white/10"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-card border border-white/10 flex items-center justify-center text-muted text-xs font-bold">
                              {(member.user.name || "?")[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-sm">{member.user.name || "Аноним"}</p>
                            <p className="text-[10px] text-primary uppercase tracking-widest font-bold">
                              {member.user.totalDistance.toFixed(1)} км
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleMemberAction(member.userId, "approve")}
                            disabled={processingIds.has(member.userId)}
                            className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 text-green-500 flex items-center justify-center hover:bg-green-500/20 transition-all active:scale-95 disabled:opacity-50"
                          >
                            {processingIds.has(member.userId) ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <UserCheck size={18} />
                            )}
                          </button>
                          <button
                            onClick={() => handleMemberAction(member.userId, "reject")}
                            disabled={processingIds.has(member.userId)}
                            className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center hover:bg-red-500/20 transition-all active:scale-95 disabled:opacity-50"
                          >
                            <UserX size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-black/20 rounded-2xl border border-white/5">
                    <p className="text-muted text-xs font-bold uppercase tracking-wider">Нет новых заявок</p>
                  </div>
                )}
              </div>
              )}
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
