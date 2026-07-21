"use client";
import { ArrowLeft, Bell, Globe, Shield, LogOut, ChevronRight, X, Loader2, Activity } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { signOut, useSession } from "next-auth/react";

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [metricSystem, setMetricSystem] = useState(true);
  const [notifications, setNotifications] = useState({
    clan: true,
    system: false
  });
  
  const [privacy, setPrivacy] = useState("CLUB");
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);
  const [touchOffset, setTouchOffset] = useState(0);

  const [isTgEnv, setIsTgEnv] = useState(false);
  
  const { data: session } = useSession();
  const [isStravaConnected, setIsStravaConnected] = useState(false);
  const [isLoadingIntegrations, setIsLoadingIntegrations] = useState(true);
  const [isSyncingStrava, setIsSyncingStrava] = useState(false);
  const [isDisconnectingStrava, setIsDisconnectingStrava] = useState(false);

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
    if (session?.user) {
      fetch(`/api/users/${(session.user as any).id}`)
        .then(res => res.json())
        .then(data => {
          if (data.user?.accounts) {
            const hasStrava = data.user.accounts.some((acc: any) => acc.provider === 'strava');
            setIsStravaConnected(hasStrava);
          }
          setIsLoadingIntegrations(false);
        })
        .catch(err => {
          console.error("Failed to fetch user integrations", err);
          setIsLoadingIntegrations(false);
        });
    }
  }, [session]);

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
  };

  const handleStravaSync = async () => {
    if (!session?.user) return;
    setIsSyncingStrava(true);
    try {
      // BUG-003 fix: server reads userId from session, no need to send it
      const res = await fetch("/api/strava/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        if (data.syncedCount > 0) {
          alert(`Синхронизировано новых тренировок: ${data.syncedCount}`);
        } else {
          alert("Новых тренировок не найдено.");
        }
      } else {
        alert("Ошибка при синхронизации.");
      }
    } catch (e) {
      console.error(e);
      alert("Ошибка при синхронизации.");
    } finally {
      setIsSyncingStrava(false);
    }
  };

  const handleStravaDisconnect = async () => {
    if (!confirm("Отвязать Strava? Новые тренировки больше не будут синхронизироваться.")) return;
    setIsDisconnectingStrava(true);
    try {
      const res = await fetch("/api/strava/disconnect", { method: "DELETE" });
      if (res.ok) {
        setIsStravaConnected(false);
      } else {
        alert("Ошибка при отвязке Strava.");
      }
    } catch (e) {
      console.error(e);
      alert("Ошибка при отвязке Strava.");
    } finally {
      setIsDisconnectingStrava(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
    setTouchOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY === 0) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY;
    
    if (diff > 0) {
      setTouchOffset(diff);
    }
    
    if (diff > 120) {
      setShowPrivacyModal(false);
      setTouchStartY(0);
      setTouchOffset(0);
    }
  };

  const handleTouchEnd = () => {
    if (touchOffset <= 120) {
      setTouchOffset(0);
    }
    setTouchStartY(0);
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

          </div>
        </div>

        {/* Integrations */}
        <div className="flex flex-col gap-2">
          <h3 className="text-[10px] font-bold text-muted uppercase tracking-wider pl-1">Интеграции</h3>
          <div className="bg-card border border-border rounded-[24px] overflow-hidden divide-y divide-border">
            
            {isLoadingIntegrations ? (
              <div className="flex items-center justify-between p-4 opacity-50">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-[#FC4C02] rounded flex items-center justify-center text-white text-[10px] font-bold">S</div>
                  <p className="font-bold">Strava</p>
                </div>
                <span className="text-xs font-bold text-muted">Загрузка...</span>
              </div>
            ) : isStravaConnected ? (
              <div className="flex flex-col">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-[#FC4C02] rounded flex items-center justify-center text-white text-[10px] font-bold">S</div>
                    <p className="font-bold">Strava</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleStravaDisconnect}
                      disabled={isSyncingStrava || isDisconnectingStrava}
                      className="text-xs font-bold text-red-500 hover:text-red-400 uppercase transition-colors"
                    >
                      {isDisconnectingStrava ? "Отвязка..." : "Отключить"}
                    </button>
                  </div>
                </div>
                <div className="px-4 pb-4">
                  <button 
                    onClick={handleStravaSync}
                    disabled={isSyncingStrava || isDisconnectingStrava}
                    className="w-full bg-border hover:bg-border/80 text-foreground text-xs font-bold uppercase tracking-widest py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {isSyncingStrava ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />}
                    {isSyncingStrava ? "Синхронизация..." : "Синхронизировать тренировки"}
                  </button>
                </div>
              </div>
            ) : (
              <Link href="/api/strava/connect" className="flex items-center justify-between p-4 hover:bg-border/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-[#FC4C02] rounded flex items-center justify-center text-white text-[10px] font-bold">S</div>
                  <p className="font-bold">Strava</p>
                </div>
                <div className="flex items-center gap-1 text-primary">
                  <span className="text-xs font-bold uppercase">Подключить</span>
                  <ChevronRight size={14} />
                </div>
              </Link>
            )}

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
      <div 
        className={`fixed inset-0 z-[100] flex justify-center ${showPrivacyModal ? 'pointer-events-auto' : 'pointer-events-none'}`}
      >
        <div className="w-full max-w-[480px] h-full relative pointer-events-none flex flex-col justify-end overflow-hidden">
          <div 
            className={`absolute inset-0 bg-gradient-to-t from-black/80 to-black/40 transition-opacity duration-500 ${showPrivacyModal ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} 
            onClick={() => setShowPrivacyModal(false)}
          ></div>
          <div 
            className={`w-full bg-card border-t border-border rounded-t-[32px] p-6 pb-32 relative z-10 shadow-2xl ${touchOffset > 0 ? 'transition-none' : 'transition-transform duration-500 ease-in-out'} ${showPrivacyModal ? 'pointer-events-auto' : 'pointer-events-none'}`}
            style={{ 
              transform: showPrivacyModal ? `translateY(${touchOffset}px)` : 'translateY(100%)'
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            
            {/* Drag Handle */}
            <div className="flex justify-center mb-4">
              <div className="w-12 h-1.5 bg-border rounded-full"></div>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-black uppercase tracking-tight">Приватность</h2>
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
                  className={`flex items-start gap-3 p-4 rounded-2xl border transition-all text-left min-h-[96px] ${
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

    </div>
  );
}
