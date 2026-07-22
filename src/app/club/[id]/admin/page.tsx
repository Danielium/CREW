"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Copy, Check, Loader2, UserCheck, UserX, Users, Shield, Key, Edit2, Target, Trash2 } from "lucide-react";
import { globalCache } from "@/lib/cache";
import Link from "next/link";
import ClubBadge from "@/components/ClubBadge";
import RankAvatar from "@/components/RankAvatar";
import React from "react";

export default function ClubAdminPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session } = useSession();

  const [club, setClub] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

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

  const fetchClub = async () => {
    try {
      const res = await fetch(`/api/clubs/${id}`);
      const data = await res.json();
      if (data.club) {
        setClub(data.club);
        setEditNameValue(data.club.name);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
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

  const copyInviteCode = async () => {
    if (!club?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(club.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for mobile
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

  const handleToggleRole = async (userId: string, currentRole: string) => {
    if (!confirm(currentRole === "PACER" ? "Убрать статус пейсера?" : "Назначить пейсером?")) return;
    setProcessingIds((prev) => new Set(prev).add(userId));
    try {
      const res = await fetch(`/api/clubs/${id}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setRole", role: currentRole === "PACER" ? "MEMBER" : "PACER" })
      });
      if (res.ok) {
        globalCache.clubs = null;
        fetchClub();
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
      const res = await fetch(`/api/clubs/${id}/members/${userId}`, { method: "DELETE" });
      if (res.ok) {
        globalCache.clubs = null;
        globalCache.userData = null;
        fetch('/api/events').then(r => r.json()).then(d => {
          if (d.events) globalCache.events = d.events;
        }).catch(() => {});
        fetchClub(); // refresh
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  if (!club) {
    return <div className="p-8 text-center text-muted">Клуб не найден</div>;
  }

  // Check founder access
  const myMembership = session
    ? club.members.find((m: any) => m.userId === (session.user as any).id)
    : null;
  const isFounder = myMembership?.role === "FOUNDER";

  if (!isFounder) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <Shield size={48} className="text-muted mb-4 opacity-30" />
        <h1 className="text-xl font-black uppercase mb-2">Доступ запрещён</h1>
        <p className="text-muted text-sm">Только основатель клуба может управлять им.</p>
      </div>
    );
  }

  const pendingMembers = club.members.filter((m: any) => m.status === "PENDING");
  const activeMembers = club.members.filter((m: any) => m.status === "ACTIVE");

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground pb-24 relative z-10">
      {/* Dynamic Background Glow */}
      <div className="fixed top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-primary/10 to-transparent -z-10 pointer-events-none" />
      <div className="fixed top-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-primary/20 rounded-full blur-[100px] -z-10 pointer-events-none opacity-50" />

      {/* Header */}
      <div className="pt-24 px-6 pb-6 flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight drop-shadow-sm">Управление</h1>
        </div>

        {/* Logo and Name Edit Section */}
        <div className="flex items-center gap-4 mt-2">
          <div className="relative group cursor-pointer shrink-0" onClick={() => {
            if (club?.logoConfig) localStorage.setItem("clubLogoConfig", club.logoConfig);
            router.push(`/club/logo-builder?admin=true&clubId=${id}`);
          }}>
            {(() => {
              try {
                const logo = JSON.parse(club.logoConfig);
                return (
                  <div className={`relative ${isUploadingLogo ? 'opacity-50' : 'opacity-100'} transition-opacity`}>
                    <ClubBadge {...logo} size={80} />
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-black shadow-lg">
                      {isUploadingLogo ? <Loader2 size={14} className="animate-spin" /> : <Edit2 size={14} />}
                    </div>
                  </div>
                );
              } catch(e) {}
              return null;
            })()}
          </div>
          
          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={editNameValue} 
                  onChange={(e) => setEditNameValue(e.target.value)}
                  className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-lg font-black uppercase focus:outline-none focus:border-primary"
                  autoFocus
                />
                <button onClick={handleSaveName} disabled={isSavingName} className="p-2 bg-primary text-black rounded-xl shrink-0">
                  {isSavingName ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 cursor-pointer group/name" onClick={() => setIsEditingName(true)}>
                <h2 className="text-2xl font-black tracking-tight uppercase truncate leading-none">{club.name}</h2>
                <button className="text-muted group-hover/name:text-primary transition-colors">
                  <Edit2 size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 flex flex-col gap-5 relative z-10">
        {/* Invite Code Section */}
        <div className="bg-card/40 backdrop-blur-xl rounded-[28px] border border-white/5 p-6 shadow-xl relative overflow-hidden group">
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

        {/* Pending Applications - Only show if club uses applications or if there are legacy pending ones */}
        {(club.joinType === "APPLICATION" || pendingMembers.length > 0) && (
        <div className="bg-card/40 backdrop-blur-xl rounded-[28px] border border-white/5 p-6 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Users size={16} />
              </div>
              <h2 className="font-black uppercase tracking-wider text-sm">Заявки</h2>
            </div>
            {pendingMembers.length > 0 && (
              <span className="bg-primary text-black text-[10px] font-black px-3 py-1 rounded-full shadow-[0_0_15px_rgba(204,255,0,0.5)]">
                {pendingMembers.length} НОВЫХ
              </span>
            )}
          </div>

          {pendingMembers.length > 0 ? (
            <div className="flex flex-col gap-3">
              {pendingMembers.map((member: any) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 pl-4 bg-black/20 border border-white/5 rounded-2xl hover:bg-black/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <RankAvatar user={member.user} size={40} />
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

        {/* Active Members Overview */}
        <div className="bg-card/40 backdrop-blur-xl rounded-[28px] border border-white/5 p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground">
              <Shield size={16} />
            </div>
            <h2 className="font-black uppercase tracking-wider text-sm text-muted-foreground">
              В клубе ({activeMembers.length})
            </h2>
          </div>

          <div className="flex flex-col gap-2">
            {activeMembers.map((member: any) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 bg-black/20 border border-white/5 rounded-2xl"
              >
                <div className="flex items-center gap-3">
                  <RankAvatar user={member.user} size={32} />
                  <div>
                    <p className="font-bold text-sm text-foreground/90">{member.user.name || "Аноним"}</p>
                    <p className="text-[9px] text-muted uppercase tracking-widest font-bold">{member.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-sm text-muted-foreground">
                    {(member.clubDistance || 0).toFixed(1)}{" "}
                    <span className="text-[10px] opacity-50 font-sans">КМ</span>
                  </span>
                  
                  {member.userId !== (session?.user as any)?.id && (
                    <div className="flex gap-1" onClick={(e) => e.preventDefault()}>
                      <button 
                        onClick={() => handleToggleRole(member.userId, member.role)} 
                        disabled={processingIds.has(member.userId)}
                        className="p-2 text-blue-500 hover:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors border border-blue-500/20 rounded-xl disabled:opacity-50" 
                        title={member.role === "PACER" ? "Убрать пейсера" : "Сделать пейсером"}
                      >
                        {processingIds.has(member.userId) ? <Loader2 size={14} className="animate-spin" /> : <Target size={14} />}
                      </button>
                      <button 
                        onClick={() => handleRemoveMember(member.userId)} 
                        disabled={processingIds.has(member.userId)}
                        className="p-2 text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors border border-red-500/20 rounded-xl disabled:opacity-50" 
                        title="Удалить участника"
                      >
                        {processingIds.has(member.userId) ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
