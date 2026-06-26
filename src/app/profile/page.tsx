"use client";

import { useState, useEffect } from "react";
import { Settings, Star, Trophy, Users, Edit3, Lock, Sunrise, LogOut, LogIn, X, Loader2, Camera, Check } from "lucide-react";
import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { TROPHIES } from "@/lib/trophies";
import { ImageCropperModal } from "@/components/ImageCropperModal";



export default function ProfileTab() {
  const { data: session, update: updateSession } = useSession();
  const [userData, setUserData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Edit Profile Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [editIsPrivate, setEditIsPrivate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [croppedFile, setCroppedFile] = useState<File | null>(null);

  const [isTgEnv, setIsTgEnv] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).Telegram?.WebApp?.initData) {
      setIsTgEnv(true);
    }
  }, []);

  useEffect(() => {
    if (session?.user) {
      fetchUserData();
    } else {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (showEditModal) {
      window.dispatchEvent(new Event("hideNav"));
    } else {
      window.dispatchEvent(new Event("showNav"));
    }
  }, [showEditModal]);

  const fetchUserData = async () => {
    try {
      const res = await fetch(`/api/users?userId=${(session?.user as any).id}`);
      const data = await res.json();
      if (data.user) {
        setUserData(data.user);
        setEditName(data.user.name || "");
        setEditAvatar(data.user.image || "");
        setEditIsPrivate(data.user.isPrivate || false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const totalKm = userData?.totalDistance || 0;

  const userTrophies = TROPHIES.map(t => ({
    ...t,
    unlocked: t.condition(totalKm)
  }));

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      let finalAvatarUrl = editAvatar;

      if (croppedFile) {
        finalAvatarUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(croppedFile);
        });
      }

      const res = await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, image: finalAvatarUrl, isPrivate: editIsPrivate }),
      });
      const data = await res.json();
      if (data.user) {
        setUserData(data.user);
        // Force session update so the avatar updates across the app (navbar etc)
        await updateSession({ name: data.user.name, image: data.user.image });
        setShowEditModal(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCropImageSrc(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (file: File, url: string) => {
    setCroppedFile(file);
    setEditAvatar(url);
    setCropImageSrc(null);
  };

  const renderAvatar = (avatarStr: string | null | undefined, sizeClass: string = "text-5xl") => {
    if (!avatarStr) return <Users size={40} className="text-muted" />;
    const isImage = avatarStr.startsWith('http') || avatarStr.startsWith('data:') || avatarStr.startsWith('blob:') || avatarStr.startsWith('/uploads');
    if (isImage) {
      return <img src={avatarStr} alt="Avatar" className="w-full h-full object-cover" />;
    }
    return <div className={`flex items-center justify-center w-full h-full ${sizeClass}`}>{avatarStr}</div>;
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={40} /></div>;
  }

  return (
    <div className="flex flex-col min-h-[100dvh] text-foreground pt-12 pb-24 relative z-10">
      {/* Header & Avatar */}
      <div className="px-4 mb-6 relative">
        <div className="absolute top-0 right-4 flex gap-3 z-30">
          <Link href="/profile/settings" className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted hover:text-foreground transition-colors">
            <Settings size={18} />
          </Link>
          {!isTgEnv && (
            <button onClick={() => signOut()} className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-red-500 hover:text-red-400 transition-colors">
              <LogOut size={18} />
            </button>
          )}
        </div>
        
        <div className="flex flex-col items-center mt-4">
          <div className="relative cursor-pointer group" onClick={() => {
            if (session) {
              setEditName(userData?.name || session.user?.name || "");
              setEditAvatar(userData?.image || session.user?.image || "");
              setEditIsPrivate(userData?.isPrivate || false);
              setShowEditModal(true);
            }
          }}>
            {/* Avatar Frame */}
            <div className="absolute -inset-2 bg-gradient-to-tr from-[#CCFF00] to-transparent rounded-full animate-pulse opacity-50"></div>
            <div className="w-28 h-28 rounded-full border-4 border-[#000] relative z-10 overflow-hidden bg-card flex items-center justify-center">
              {renderAvatar(userData?.image || session?.user?.image)}
            </div>
            
            <div className="absolute -bottom-2 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-black z-20 border-2 border-background shadow-lg transition-transform group-hover:scale-110">
              <Edit3 size={14} />
            </div>
          </div>
          
          <h1 className="text-3xl font-black mt-4 uppercase text-center">{userData?.name || session?.user?.name || "Гость"}</h1>
          <p className="text-primary font-bold text-sm uppercase tracking-wider text-center px-4 leading-snug">
            {(() => {
              const goalStr = userData?.goal;
              if (!goalStr) return "Ставьте цели и достигайте их!";
              try {
                const parsed = JSON.parse(goalStr);
                if (Array.isArray(parsed)) return parsed.join(' • ');
                return goalStr;
              } catch (e) {
                return goalStr;
              }
            })()}
          </p>
          
        </div>
      </div>

      <div className="flex flex-col gap-6 px-4">
        {/* Trophy Cabinet */}
        <div className="mb-24">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold uppercase text-sm tracking-wider">Мои трофеи</h3>
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

      {/* EDIT PROFILE MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-[100] flex justify-center pointer-events-none">
          <div className="w-full max-w-[480px] h-full relative pointer-events-none flex flex-col justify-end">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm pointer-events-auto" onClick={() => setShowEditModal(false)}></div>
            <div className="w-full bg-card border-t border-border rounded-t-[32px] p-6 pb-12 pointer-events-auto relative z-10 animate-in slide-in-from-bottom-full duration-300 shadow-2xl">
            
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black uppercase tracking-tight">Редактировать</h2>
              <button onClick={() => setShowEditModal(false)} className="w-10 h-10 bg-background rounded-full flex items-center justify-center text-foreground hover:bg-border transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col items-center mb-8">
              <div className="w-24 h-24 rounded-full border-2 border-primary bg-background flex items-center justify-center overflow-hidden mb-4 relative group">
                {renderAvatar(editAvatar, "text-4xl")}
              </div>
            </div>

            <div className="space-y-6">
              {/* Name Field */}
              <div>
                <label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2 block">Имя / Никнейм</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-foreground focus:outline-none focus:border-primary transition-colors font-medium"
                  placeholder="Ваше имя"
                />
              </div>

              {/* Avatar Picker */}
              <div>
                <label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2 block">Аватар</label>

                <label className="w-full mt-3 flex items-center justify-center gap-2 bg-background border border-border hover:bg-border transition-colors rounded-2xl px-4 py-3 text-foreground font-medium cursor-pointer">
                  <Camera size={18} />
                  Выбрать из галереи
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Privacy Toggle */}
              <div className="flex items-center justify-between bg-background border border-border rounded-2xl px-4 py-3 mt-4">
                <div className="flex flex-col">
                  <span className="font-bold text-sm text-foreground">Закрытый профиль</span>
                  <span className="text-[10px] text-muted">Скрыть статистику от других</span>
                </div>
                <button
                  onClick={() => setEditIsPrivate(!editIsPrivate)}
                  className={`w-12 h-6 rounded-full p-1 transition-colors ${editIsPrivate ? 'bg-primary' : 'bg-border'} relative flex items-center shrink-0`}
                >
                  <div className={`w-4 h-4 rounded-full bg-black transition-transform ${editIsPrivate ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            <button 
              onClick={handleSaveProfile}
              disabled={isSaving || !editName.trim()}
              className="w-full mt-8 py-4 rounded-2xl bg-primary text-black font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-[#b3e600] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="animate-spin" size={20} /> : <><Check size={20} /> Сохранить</>}
            </button>

          </div>
        </div>
        </div>
      )}

      {cropImageSrc && (
        <ImageCropperModal 
          imageSrc={cropImageSrc}
          onCropComplete={handleCropComplete}
          onClose={() => setCropImageSrc(null)}
        />
      )}

    </div>
  );
}
