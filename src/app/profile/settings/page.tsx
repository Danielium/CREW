"use client";
import { ArrowLeft, Bell, Globe, Shield, LogOut, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [metricSystem, setMetricSystem] = useState(true);
  const [notifications, setNotifications] = useState({
    clan: true,
    friends: true,
    system: false
  });
  
  const [privacy, setPrivacy] = useState("CLUB");
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const [isTgEnv, setIsTgEnv] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
    const savedPrivacy = localStorage.getItem("profilePrivacy");
    if (savedPrivacy) setPrivacy(savedPrivacy);

    if (typeof window !== "undefined" && (window as any).Telegram?.WebApp?.initData) {
      setIsTgEnv(true);
    }
  }, []);

  useEffect(() => {
    if (showPrivacyModal) {
      window.dispatchEvent(new Event("hideNav"));
    } else {
      window.dispatchEvent(new Event("showNav"));
    }
  }, [showPrivacyModal]);

  const toggleNotif = (key: keyof typeof notifications) => {
    setNotifications(prev => ({...prev, [key]: !prev[key]}));
  };

  const handleSavePrivacy = (value: string) => {
    setPrivacy(value);
    localStorage.setItem("profilePrivacy", value);
    setShowPrivacyModal(false);
  };

  const PRIVACY_LABELS: Record<string, string> = {
    PUBLIC: "Все",
    CLUB: "Только клуб",
    PRIVATE: "Только я",
  };

  return (
    <div className="flex flex-col min-h-[100dvh] text-foreground bg-background z-50 relative pb-12">
      {/* Header */}
      <div className="sticky top-0 bg-background/80 backdrop-blur-md z-10 px-4 pb-4 pt-safe flex items-center gap-4 border-b border-border">
        {/* Native back button used here */}
        <h1 className="text-xl font-bold uppercase tracking-tight">Настройки</h1>
      </div>

      <div className="p-4 flex flex-col gap-6">



        {/* General */}
        <div className="flex flex-col gap-2">
          <h3 className="text-[10px] font-bold text-muted uppercase tracking-wider pl-1">Основные</h3>
          <div className="bg-card border border-border rounded-[24px] overflow-hidden divide-y divide-border">
            
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Globe size={20} className="text-muted" />
                <p className="font-bold">Единицы измерения</p>
              </div>
              <div className="flex bg-background border border-border rounded-full p-1">
                <button 
                  onClick={() => setMetricSystem(true)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${metricSystem ? 'bg-primary text-black' : 'text-muted'}`}
                >
                  КМ
                </button>
                <button 
                  onClick={() => setMetricSystem(false)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${!metricSystem ? 'bg-primary text-black' : 'text-muted'}`}
                >
                  МИЛИ
                </button>
              </div>
            </div>

            <div 
              onClick={() => setShowPrivacyModal(true)}
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#222] transition-colors"
            >
              <div className="flex items-center gap-3">
                <Shield size={20} className="text-muted" />
                <div>
                  <p className="font-bold">Приватность профиля</p>
                  <p className="text-[10px] text-muted">Кто видит ваши пробежки</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-primary font-bold">
                {PRIVACY_LABELS[privacy] || "Только клуб"} <ChevronRight size={16} className="text-muted" />
              </div>
            </div>
            
          </div>
        </div>

        {/* Notifications */}
        <div className="flex flex-col gap-2">
          <h3 className="text-[10px] font-bold text-muted uppercase tracking-wider pl-1">Уведомления</h3>
          <div className="bg-card border border-border rounded-[24px] overflow-hidden divide-y divide-border">
            
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Bell size={20} className="text-muted" />
                <p className="font-bold">События Клуба</p>
              </div>
              {/* Toggle Switch */}
              <button 
                onClick={() => toggleNotif('clan')}
                className={`w-12 h-6 rounded-full transition-colors relative ${notifications.clan ? 'bg-primary text-black' : 'bg-border'}`}
              >
                <div className={`w-5 h-5 bg-foreground rounded-full absolute top-0.5 transition-transform ${notifications.clan ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
              </button>
            </div>

            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Bell size={20} className="text-muted" />
                <p className="font-bold">Новые подписчики</p>
              </div>
              {/* Toggle Switch */}
              <button 
                onClick={() => toggleNotif('friends')}
                className={`w-12 h-6 rounded-full transition-colors relative ${notifications.friends ? 'bg-primary text-black' : 'bg-border'}`}
              >
                <div className={`w-5 h-5 bg-foreground rounded-full absolute top-0.5 transition-transform ${notifications.friends ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
              </button>
            </div>

          </div>
        </div>

        {/* Danger Zone */}
        {!isTgEnv && (
          <div className="mt-8">
            <button onClick={() => signOut()} className="w-full bg-red-500/10 border border-red-500/20 text-red-500 font-bold uppercase tracking-widest text-center py-4 rounded-[20px] hover:bg-red-500/20 active:scale-95 transition-all flex justify-center items-center gap-2">
              <LogOut size={18} /> Выйти из аккаунта
            </button>
          </div>
        )}

      </div>

      {/* Privacy Select Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-[100] flex justify-center pointer-events-none">
          <div className="w-full max-w-[480px] h-full relative pointer-events-none flex flex-col justify-end">
            <div 
              className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/40 pointer-events-auto" 
              onClick={() => setShowPrivacyModal(false)}
            ></div>
            <div className="w-full bg-card border-t border-border rounded-t-[32px] p-6 pb-12 pointer-events-auto relative z-10 animate-in slide-in-from-bottom-full duration-300 shadow-2xl">
              
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black uppercase tracking-tight">Приватность</h2>
                <button 
                  onClick={() => setShowPrivacyModal(false)} 
                  className="w-10 h-10 bg-background border border-border rounded-full flex items-center justify-center text-foreground hover:bg-border transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {[
                  { id: "PUBLIC", title: "Все", desc: "Любой пользователь может видеть вашу статистику и историю пробежек." },
                  { id: "CLUB", title: "Только клуб", desc: "Ваши пробежки видны только участникам вашего бегового клуба." },
                  { id: "PRIVATE", title: "Только я", desc: "Ваша статистика полностью приватна и видна только вам." },
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleSavePrivacy(option.id)}
                    className={`flex items-start gap-3 p-4 rounded-2xl border transition-all text-left ${
                      privacy === option.id 
                        ? "bg-primary/10 border-primary" 
                        : "bg-background border-border hover:border-muted cursor-pointer"
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`font-bold text-sm uppercase ${privacy === option.id ? "text-primary" : "text-foreground"}`}>
                          {option.title}
                        </span>
                        {privacy === option.id && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="text-xs text-muted mt-1 leading-relaxed">{option.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
