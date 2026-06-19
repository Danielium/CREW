"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Copy, Check, Loader2, UserCheck, UserX, Users, Shield, Key } from "lucide-react";
import Link from "next/link";

export default function ClubAdminPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session } = useSession();

  const [club, setClub] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchClub();
  }, [id]);

  const fetchClub = async () => {
    try {
      const res = await fetch(`/api/clubs/${id}`);
      const data = await res.json();
      if (data.club) {
        setClub(data.club);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
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
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground pb-24">
      {/* Header */}
      <div className="pt-12 px-4 pb-6 flex items-center gap-3">
        <Link
          href={`/club/${id}`}
          className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center hover:bg-border transition-colors"
        >
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight">Управление</h1>
          <p className="text-xs text-muted font-medium">{club.name}</p>
        </div>
      </div>

      <div className="px-4 flex flex-col gap-6">
        {/* Invite Code Section */}
        <div className="bg-card rounded-[24px] border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Key size={16} className="text-primary" />
            <h2 className="font-bold uppercase tracking-wider text-sm">Код приглашения</h2>
          </div>
          <p className="text-xs text-muted mb-4">
            Поделитесь этим кодом с людьми, чтобы они могли вступить в клуб напрямую.
          </p>

          <div className="flex items-center gap-3">
            <div className="flex-1 bg-background border border-border rounded-2xl p-4 font-mono text-xl font-black tracking-[0.3em] text-center text-primary select-all">
              {club.inviteCode || "—"}
            </div>
            <button
              onClick={copyInviteCode}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                copied
                  ? "bg-green-500 text-white"
                  : "bg-primary text-black hover:bg-[#b3e600]"
              }`}
            >
              {copied ? <Check size={24} /> : <Copy size={24} />}
            </button>
          </div>
        </div>

        {/* Pending Applications */}
        <div className="bg-card rounded-[24px] border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-primary" />
              <h2 className="font-bold uppercase tracking-wider text-sm">Заявки</h2>
            </div>
            {pendingMembers.length > 0 && (
              <span className="bg-primary text-black text-xs font-black px-2.5 py-1 rounded-full">
                {pendingMembers.length}
              </span>
            )}
          </div>

          {pendingMembers.length > 0 ? (
            <div className="flex flex-col gap-3">
              {pendingMembers.map((member: any) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 bg-background border border-border rounded-2xl"
                >
                  <div className="flex items-center gap-3">
                    {member.user.image ? (
                      <img
                        src={member.user.image}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover border border-border"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted text-xs font-bold">
                        {(member.user.name || "?")[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-sm">{member.user.name || "Аноним"}</p>
                      <p className="text-[10px] text-muted uppercase tracking-wider">
                        {member.user.totalDistance.toFixed(1)} км пробега
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleMemberAction(member.userId, "approve")}
                      disabled={processingIds.has(member.userId)}
                      className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/30 text-green-500 flex items-center justify-center hover:bg-green-500/20 transition-colors disabled:opacity-50"
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
                      className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 flex items-center justify-center hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      <UserX size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted text-sm">
              Нет ожидающих заявок
            </div>
          )}
        </div>

        {/* Active Members Overview */}
        <div className="bg-card rounded-[24px] border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={16} className="text-primary" />
            <h2 className="font-bold uppercase tracking-wider text-sm">
              Участники ({activeMembers.length})
            </h2>
          </div>

          <div className="flex flex-col gap-2">
            {activeMembers.map((member: any) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 bg-background border border-border rounded-xl"
              >
                <div className="flex items-center gap-3">
                  {member.user.image ? (
                    <img
                      src={member.user.image}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover border border-border"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted text-xs font-bold">
                      {(member.user.name || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-sm">{member.user.name || "Аноним"}</p>
                    <p className="text-[10px] text-muted uppercase tracking-wider">{member.role}</p>
                  </div>
                </div>
                <span className="font-mono font-bold text-sm">
                  {member.user.totalDistance.toFixed(1)}{" "}
                  <span className="text-[10px] text-muted">КМ</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
