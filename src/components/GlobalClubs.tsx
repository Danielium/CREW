"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ClubBadge from "@/components/ClubBadge";
import { Loader2, Users, Key, Search } from "lucide-react";

export default function GlobalClubs({ inClub }: { inClub?: boolean }) {
  const [clubs, setClubs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetch('/api/clubs', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data.clubs) setClubs(data.clubs);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch clubs:", err);
        setIsLoading(false);
      });
  }, []);

  const handleJoinByCode = async () => {
    if (!inviteCode.trim()) return;
    setIsJoining(true);
    setInviteError("");
    try {
      const res = await fetch("/api/clubs/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: inviteCode.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.clubId) {
        router.push(`/club/${data.clubId}`);
      } else {
        setInviteError(data.error || "Ошибка");
      }
    } catch {
      setInviteError("Ошибка сети");
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary" size={32} /></div>;

  const filteredClubs = clubs.filter(club => 
    club.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (club.description && club.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="px-4">
      {/* Invite Code Input */}
      {!inClub && (
        <div className="bg-card rounded-[20px] border border-border p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Key size={14} className="text-primary" />
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Вступить по коду</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => { setInviteCode(e.target.value.toUpperCase()); setInviteError(""); }}
              placeholder="XXXXXX"
              className="flex-1 bg-background border border-border rounded-xl px-4 py-3 font-mono font-bold text-center tracking-[0.2em] uppercase text-sm placeholder:text-muted/50 outline-none focus:border-primary transition-colors"
              maxLength={10}
              onKeyDown={(e) => { if (e.key === "Enter") handleJoinByCode(); }}
            />
            <button
              onClick={handleJoinByCode}
              disabled={isJoining || !inviteCode.trim()}
              className="px-5 py-3 rounded-xl bg-primary text-black font-bold uppercase tracking-wider text-xs hover:bg-[#b3e600] transition-colors disabled:opacity-50"
            >
              {isJoining ? <Loader2 size={16} className="animate-spin" /> : "Войти"}
            </button>
          </div>
          {inviteError && <p className="text-red-500 text-xs mt-2 font-medium">{inviteError}</p>}
        </div>
      )}

      {/* Search Input */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск клубов..."
          className="w-full bg-card border border-border rounded-2xl pl-12 pr-4 py-4 text-sm placeholder:text-muted/50 outline-none focus:border-primary transition-colors"
        />
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-black tracking-tight uppercase">Битва Клубов</h2>
        <p className="text-xs text-muted uppercase tracking-wider font-bold mt-1">Топ беговых клубов мира</p>
      </div>

      <div className="flex flex-col gap-3">
        {filteredClubs.map((club, i) => (
          <Link href={`/club/${club.id}`} key={club.id}>
            <div className="bg-card border border-border rounded-[20px] p-4 flex items-center justify-between hover:border-primary transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm border-2 flex-shrink-0 ${i === 0 ? 'bg-primary border-primary text-black shadow-[0_0_10px_#CCFF00]' : i === 1 ? 'bg-slate-300 border-slate-300 text-black' : i === 2 ? 'bg-amber-700 border-amber-700 text-white' : 'bg-background border-border text-muted'}`}>
                  {i + 1}
                </div>
                {(() => {
                  try {
                    const logo = JSON.parse(club.logoConfig);
                    if (logo && logo.shape) return <div className="flex-shrink-0"><ClubBadge {...logo} size={40} /></div>;
                  } catch(e) {}
                  return null;
                })()}
                <div>
                  <h3 className="font-black uppercase tracking-tight text-lg leading-none mb-1">{club.name}</h3>
                  <div className="flex items-center gap-3 text-[10px] text-muted font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1"><Users size={12}/> {club._count.members}</span>
                    <span className="text-primary">{club.joinType}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-xl font-bold">{club.totalClubDistance.toFixed(0)}</p>
                <p className="text-[10px] text-muted uppercase font-bold tracking-wider">КМ</p>
              </div>
            </div>
          </Link>
        ))}
        {clubs.length === 0 ? (
          <div className="text-center p-8 bg-card rounded-3xl border border-border text-muted">
            Пока нет ни одного клуба. Станьте первым!
          </div>
        ) : filteredClubs.length === 0 ? (
          <div className="text-center p-8 bg-card rounded-3xl border border-border text-muted">
            Клубы по вашему запросу не найдены.
          </div>
        ) : null}
      </div>
    </div>
  );
}
