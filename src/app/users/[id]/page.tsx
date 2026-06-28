"use client";

import { useState, useEffect } from "react";
import { Lock, Footprints, Loader2, User as UserIcon, Trophy, Calendar, ArrowLeft } from "lucide-react";
import { useSession } from "next-auth/react";
import { TROPHIES } from "@/lib/trophies";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";

export default function PublicProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`/api/users/${id}`);
        const data = await res.json();
        if (data.user) {
          setUserData(data.user);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchUser();
  }, [id]);

  const renderAvatar = (url: string | null | undefined, className = "text-xl") => {
    if (url) {
      return <img src={url} alt="avatar" className="w-full h-full object-cover" />;
    }
    return <UserIcon className={`text-muted ${className}`} />;
  };

  const formatPace = (pace: number) => {
    if (!pace || !isFinite(pace)) return "--:--";
    const min = Math.floor(pace);
    const sec = Math.floor((pace - min) * 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="flex flex-col min-h-[100dvh] items-center justify-center bg-background text-foreground">
        <p>Пользователь не найден</p>
        <button onClick={() => router.back()} className="mt-4 text-primary underline">Назад</button>
      </div>
    );
  }

  const totalKm = userData.totalDistance || 0;
  const userTrophies = TROPHIES.map(t => ({
    ...t,
    unlocked: t.condition(totalKm)
  }));

  return (
    <div className="flex flex-col min-h-[100dvh] text-foreground relative z-10 animate-in fade-in duration-500 pb-24">
      {/* Header Bar */}
      <div className="flex justify-between items-center px-4 py-4 sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <h1 className="text-xl font-black uppercase tracking-widest">Профиль</h1>
        {/* Native back button used here */}
      </div>

      {/* Main Profile Info */}
      <div className="flex flex-col items-center pt-8 pb-6 border-b border-border relative overflow-hidden bg-card/30">
        <div className="absolute inset-0 z-0 opacity-20" style={{ backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative">
            <div className="w-28 h-28 rounded-full border-4 border-[#000] relative z-10 overflow-hidden bg-card flex items-center justify-center">
              {renderAvatar(userData.image)}
            </div>
          </div>
          
          <h1 className="text-3xl font-black mt-4 uppercase text-center">{userData.name || "Гость"}</h1>
        </div>
      </div>

      {userData.isPrivate ? (
        <div className="flex flex-col items-center justify-center p-12 text-center text-muted">
          <div className="w-16 h-16 bg-card rounded-full flex items-center justify-center mb-4 border border-border shadow-lg">
            <Lock size={24} className="text-foreground/50" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">Профиль закрыт</h3>
          <p className="text-sm max-w-[250px]">Этот пользователь ограничил просмотр своей статистики настройками приватности.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 px-4 pt-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center justify-center text-center">
              <Footprints size={16} className="text-primary mb-2 opacity-80" />
              <span className="text-[10px] text-muted font-bold uppercase tracking-widest mb-1">Пробежки</span>
              <span className="text-xl font-black">{userData.runs?.length || 0}</span>
            </div>
            
            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center justify-center text-center">
              <Trophy size={16} className="text-[#CCFF00] mb-2 opacity-80" />
              <span className="text-[10px] text-muted font-bold uppercase tracking-widest mb-1">Дистанция</span>
              <span className="text-xl font-black">{totalKm.toFixed(0)}<span className="text-xs font-bold text-muted ml-0.5">км</span></span>
            </div>
          </div>

          {/* Trophy Cabinet */}
          <div>
            <div className="flex justify-between items-center mb-4 mt-4">
              <h3 className="font-bold uppercase text-sm tracking-wider">Трофеи</h3>
              <span className="bg-primary text-black text-xs font-bold px-2 py-1 rounded-lg">{userTrophies.filter(t => t.unlocked).length} / {userTrophies.length}</span>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              {userTrophies.map((trophy) => (
                <div 
                  key={trophy.id} 
                  className={`relative flex flex-col items-center justify-center p-3 rounded-[20px] border ${
                    trophy.unlocked 
                      ? "bg-card border-border shadow-[0_4px_12px_rgba(0,0,0,0.5)]" 
                      : "bg-background border-border opacity-50 grayscale"
                  } aspect-square text-center`}
                >
                  {!trophy.unlocked && (
                    <div className="absolute inset-0 bg-card/70 rounded-[20px] flex items-center justify-center z-20 backdrop-blur-[1px]">
                      <Lock size={20} className="text-[#555]" />
                    </div>
                  )}
                  <div className={`mb-2 ${trophy.unlocked ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]" : ""}`}>
                    {trophy.icon}
                  </div>
                  <h4 className="font-bold text-[10px] leading-tight mb-1 z-10">{trophy.name}</h4>
                  <p className="text-[8px] text-muted leading-tight z-10">{trophy.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
