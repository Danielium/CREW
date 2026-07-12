"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ClubBadge from "@/components/ClubBadge";
import { Loader2, Users, Key, Search } from "lucide-react";

import { globalCache } from "@/lib/cache";

export default function GlobalClubs({ inClub }: { inClub?: boolean }) {
  const [clubs, setClubs] = useState<any[]>(globalCache.clubs || []);
  const [isLoading, setIsLoading] = useState(!globalCache.clubs);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetch('/api/clubs', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data.clubs) {
          setClubs(data.clubs);
          globalCache.clubs = data.clubs;
        }
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

  const query = searchQuery.trim().toLowerCase();
  
  // Assign global ranks before filtering
  const clubsWithRank = clubs.map((c, i) => ({ ...c, rank: i + 1 }));
  
  const filteredClubs = query ? clubsWithRank.filter(club => 
    club.name.toLowerCase().includes(query) ||
    (club.description && club.description.toLowerCase().includes(query))
  ) : clubsWithRank;

  return (
    <div className="px-4 relative z-10">
      {/* Invite Code Input */}
      {!inClub && (
        <div className="bg-card/40 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 mb-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
              <Key size={12} className="text-primary" />
            </div>
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Вступить по коду</span>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => { setInviteCode(e.target.value.toUpperCase()); setInviteError(""); }}
              placeholder="XXXXXX"
              className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-4 py-4 font-mono font-bold text-center tracking-[0.2em] uppercase text-sm placeholder:text-muted/50 outline-none focus:border-primary/50 transition-colors shadow-inner"
              maxLength={10}
              onKeyDown={(e) => { if (e.key === "Enter") handleJoinByCode(); }}
            />
            <button
              onClick={handleJoinByCode}
              disabled={isJoining || !inviteCode.trim()}
              className="px-6 py-4 rounded-2xl bg-primary text-black font-bold uppercase tracking-wider text-xs hover:bg-[#b3e600] active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              {isJoining ? <Loader2 size={18} className="animate-spin mx-auto" /> : "Войти"}
            </button>
          </div>
          {inviteError && <p className="text-red-500 text-xs mt-3 font-medium px-2">{inviteError}</p>}
        </div>
      )}

      {/* Search Input */}
      <div className="relative mb-8">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
          <Search className="text-muted-foreground" size={14} />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск клубов..."
          className="w-full bg-card/40 backdrop-blur-xl border border-white/5 rounded-[24px] pl-16 pr-12 py-5 text-sm placeholder:text-muted/50 outline-none focus:border-primary/50 transition-colors shadow-lg"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-muted-foreground transition-colors"
          >
            ×
          </button>
        )}
      </div>

      <div className="mb-6 px-2 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight uppercase drop-shadow-sm">
            {query ? "Результаты" : "Битва Клубов"}
          </h2>
          <p className="text-xs text-primary uppercase tracking-widest font-bold mt-1">
            {query ? `Найдено: ${filteredClubs.length}` : "Топ беговых клубов"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {filteredClubs.map((club) => (
          <Link href={`/club/${club.id}`} key={club.id}>
            <div className="bg-card/40 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 flex items-center justify-between hover:border-primary/50 hover:bg-black/20 transition-all shadow-lg group">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xl italic tracking-tighter border-2 flex-shrink-0 shadow-lg ${
                  club.rank === 1 ? 'bg-primary border-primary text-black shadow-primary/30' : 
                  club.rank === 2 ? 'bg-slate-300 border-slate-300 text-black shadow-slate-300/30' : 
                  club.rank === 3 ? 'bg-amber-700 border-amber-700 text-white shadow-amber-700/30' : 
                  'bg-black/50 border-white/10 text-muted-foreground'
                }`}>
                  {club.rank}
                </div>
                {(() => {
                  try {
                    const logo = JSON.parse(club.logoConfig);
                    if (logo && logo.shape) return <div className="flex-shrink-0 drop-shadow-md group-hover:scale-105 transition-transform"><ClubBadge {...logo} size={44} /></div>;
                  } catch(e) {}
                  return null;
                })()}
                <div className="ml-1">
                  <h3 className={`font-black uppercase tracking-tight ${club.name.length > 12 ? 'text-sm break-all' : 'text-lg'} leading-none mb-2 text-foreground/90 group-hover:text-white transition-colors`}>{club.name}</h3>
                  <div className="flex items-center gap-3 text-[10px] text-muted font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1.5"><Users size={12} className="text-primary/70"/> {club._count.members}</span>
                    <span className="text-primary/70 px-2 py-0.5 bg-primary/10 rounded-full">{club.joinType}</span>
                  </div>
                </div>
              </div>
              <div className="text-right flex flex-col items-end justify-center">
                <p className="text-2xl font-black italic tracking-tighter text-white/90 drop-shadow-md">{club.totalClubDistance.toFixed(1)}</p>
                <p className="text-[9px] text-primary uppercase font-black tracking-widest mt-0.5">КМ</p>
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
