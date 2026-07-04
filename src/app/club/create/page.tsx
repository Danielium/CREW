"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, Flag, Users, Shield, Lock, Hash, Loader2, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ClubBadge from "@/components/ClubBadge";
import { globalCache } from "@/lib/cache";

const AVAILABLE_TAGS = [
  "Party Pace", "Hardcore", "Beginners", "Dogs friendly", 
  "Track", "Trail", "Morning Crew", "Night Owls", "Beer Runners"
];

const DEFAULT_LOGO = {
  shape: "circle",
  pattern: "solid",
  color1: "#FFFFFF",
  color2: "#111111",
  iconName: "Zap",
  iconColor: "#111111"
};

export default function CreateClubPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [joinType, setJoinType] = useState("OPEN");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [logoConfig, setLogoConfig] = useState<any>(DEFAULT_LOGO);

  useEffect(() => {
    const checkLogo = () => {
      const savedLogo = localStorage.getItem("clubLogoConfig");
      if (savedLogo) {
        try {
          const parsed = JSON.parse(savedLogo);
          setLogoConfig(prev => {
            // Only update if changed to avoid unnecessary re-renders
            if (JSON.stringify(prev) !== JSON.stringify(parsed)) {
              return parsed;
            }
            return prev;
          });
        } catch (e) {}
      }
    };
    
    checkLogo();
    // Poll to catch updates when returning via history.back()
    const interval = setInterval(checkLogo, 500);
    return () => clearInterval(interval);
  }, []);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else if (selectedTags.length < 3) {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: desc,
          joinType,
          tags: selectedTags,
          logoConfig,
        }),
      });
      const data = await res.json();
      if (data.club) {
        globalCache.clubs = null;
        globalCache.userData = null;
        router.push(`/club/${data.club.id}`);
      } else {
        alert(data.error || "Ошибка при создании клуба");
        setIsLoading(false);
      }
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  };

  if (!session) return <div className="p-8 text-center text-muted">Необходимо войти в систему</div>;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground pb-12 relative z-10">
      {/* Dynamic Background Glow */}
      <div className="fixed top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-primary/10 to-transparent -z-10 pointer-events-none" />
      <div className="fixed top-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-primary/20 rounded-full blur-[100px] -z-10 pointer-events-none opacity-50" />

      <div className="sticky top-0 z-50 bg-background/60 backdrop-blur-xl pt-safe pb-4 px-4 flex items-center gap-4 border-b border-white/5">
        <h1 className="text-2xl font-black uppercase tracking-tight drop-shadow-sm">Создать Клуб</h1>
      </div>

      <div className="px-6 py-6 flex flex-col gap-8 flex-1 relative z-10">
        
        {/* Logo Preview */}
        <div className="flex flex-col items-center justify-center py-6 bg-card/40 backdrop-blur-xl border border-white/5 rounded-[28px] relative overflow-hidden group shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[50px] -z-10 group-hover:bg-primary/20 transition-all duration-500" />
          {logoConfig ? (
            <div className="relative z-10 scale-[0.85] drop-shadow-xl">
              <ClubBadge {...logoConfig} />
            </div>
          ) : (
            <div className="w-24 h-24 rounded-2xl bg-black/40 border-2 border-dashed border-white/10 flex items-center justify-center mb-2 z-10 text-muted">
              <Shield size={32} />
            </div>
          )}
          
          <Link href="/club/logo-builder" className="relative z-10 mt-3 px-5 py-2.5 bg-black/40 border border-white/10 rounded-full text-xs font-bold uppercase tracking-wider hover:border-primary/50 transition-colors shadow-lg">
            {logoConfig ? "Изменить эмблему" : "Создать эмблему"}
          </Link>
        </div>

        {/* Basic Info */}
        <div className="flex flex-col gap-4 bg-card/40 backdrop-blur-xl border border-white/5 rounded-[28px] p-6 shadow-xl">
          <div>
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2 block">Название клуба</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              className="w-full bg-black/40 border border-white/5 rounded-2xl px-4 py-4 text-foreground text-lg focus:outline-none focus:border-primary/50 transition-colors font-black uppercase tracking-wide"
              placeholder="Введите название"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2 block">Описание клуба</label>
            <textarea 
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full bg-card border border-border rounded-2xl px-4 py-3 text-foreground focus:outline-none focus:border-primary transition-colors text-sm min-h-[100px] resize-none"
              placeholder="Расскажите о клубе: где и как часто вы бегаете, кого ждете в команду"
            />
          </div>
        </div>

        {/* Join Type */}
        <div>
          <label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3 flex items-center gap-2"><Shield size={14}/> Эксклюзивность</label>
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => setJoinType("OPEN")}
              className={`flex items-start gap-3 p-4 rounded-2xl border transition-all text-left ${joinType === "OPEN" ? "bg-primary/10 border-primary" : "bg-card border-border"}`}
            >
              <Users size={20} className={joinType === "OPEN" ? "text-primary" : "text-muted"} />
              <div>
                <h3 className="font-bold text-sm uppercase">Открытый</h3>
                <p className="text-xs text-muted mt-1">Любой желающий может вступить в один клик.</p>
              </div>
            </button>

            <button 
              onClick={() => setJoinType("APPLICATION")}
              className={`flex items-start gap-3 p-4 rounded-2xl border transition-all text-left ${joinType === "APPLICATION" ? "bg-primary/10 border-primary" : "bg-card border-border"}`}
            >
              <Hash size={20} className={joinType === "APPLICATION" ? "text-primary" : "text-muted"} />
              <div>
                <h3 className="font-bold text-sm uppercase">По заявкам</h3>
                <p className="text-xs text-muted mt-1">Вы свайпаете кандидатов. Элитарный клуб.</p>
              </div>
            </button>

            <button 
              onClick={() => setJoinType("INVITE_ONLY")}
              className={`flex items-start gap-3 p-4 rounded-2xl border transition-all text-left ${joinType === "INVITE_ONLY" ? "bg-primary/10 border-primary" : "bg-card border-border"}`}
            >
              <Lock size={20} className={joinType === "INVITE_ONLY" ? "text-primary" : "text-muted"} />
              <div>
                <h3 className="font-bold text-sm uppercase">Закрытый</h3>
                <p className="text-xs text-muted mt-1">Только по секретной ссылке-инвайту.</p>
              </div>
            </button>
          </div>
        </div>

        {/* Vibe Tags */}
        <div>
          <label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3 flex items-center gap-2"><Flag size={14}/> Вайб (до 3 тегов)</label>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
                  selectedTags.includes(tag) 
                    ? "bg-primary text-black border-primary" 
                    : "bg-card border-border text-muted hover:border-muted"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

      </div>

      <div className="px-6 mt-8">
        <button 
          onClick={handleCreate}
          disabled={isLoading || !name.trim()}
          className="w-full py-4 rounded-2xl bg-primary text-black font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-[#b3e600] active:scale-[0.98] transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(204,255,0,0.3)]"
        >
          {isLoading ? <Loader2 className="animate-spin" size={20} /> : <><Check size={20} /> Зарегистрировать</>}
        </button>
      </div>

    </div>
  );
}
