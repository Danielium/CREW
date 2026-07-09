"use client";
import { Suspense, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Bell, MapPin, Clock, Users, X, Search, Activity, ArrowLeft, LocateFixed, Share } from "lucide-react";
import { SwipeButton } from "@/components/SwipeButton";
import { triggerHaptic } from "@/lib/haptics";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

const TinderMap = dynamic(() => import("@/components/TinderMap"), { ssr: false });

function MapContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [proposals, setProposals] = useState<any[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<any | null>(null);
  const [hasUnreadRequests, setHasUnreadRequests] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [forceCenter, setForceCenter] = useState<[number, number] | null>(null);
  const [touchStartY, setTouchStartY] = useState(0);
  const [touchOffset, setTouchOffset] = useState(0);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showClubJoinModal, setShowClubJoinModal] = useState(false);
  const [isJoiningClub, setIsJoiningClub] = useState(false);

  useEffect(() => {
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const focus = searchParams.get('focus');
    
    if (lat && lng) {
      setForceCenter([parseFloat(lat), parseFloat(lng)]);
    }
    
    let focusId = focus;
    
    // Support Telegram Mini App startapp parameter
    const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
    const startParam = tg?.initDataUnsafe?.start_param;
    if (startParam && startParam.startsWith('focus_')) {
      focusId = startParam.replace('focus_', '');
    }
    
    if (focusId && proposals.length > 0) {
      const p = proposals.find(pr => pr.id === focusId);
      if (p && (!selectedProposal || selectedProposal.id !== focusId)) {
        handleSelectProposal(p);
      }
    }
  }, [searchParams, proposals]);

  useEffect(() => {
    if (session?.user) {
      const lastSync = localStorage.getItem("lastStravaSync");
      const now = Date.now();
      // Auto-sync every 15 minutes (900000 ms) silently in background
      if (!lastSync || now - parseInt(lastSync) > 900000) {
        // BUG-003 fix: server reads userId from session, no body needed
        fetch("/api/strava/sync", { method: "POST" }).catch(() => {});
        localStorage.setItem("lastStravaSync", now.toString());
      }
    }
  }, [session]);

  const [isEditingProposal, setIsEditingProposal] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editPace, setEditPace] = useState("");
  const [justJoinedMap, setJustJoinedMap] = useState<Record<string, boolean>>({});
  const [editLimit, setEditLimit] = useState("");
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  useEffect(() => {
    // Show the hint every time the map is opened
    setShowHint(true);
    const timer = setTimeout(() => {
      setShowHint(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
    setTouchOffset(0);
  };

  const closeSheet = () => {
    setIsSheetOpen(false);
    setTimeout(() => {
      setSelectedProposal(null);
      setIsEditingProposal(false);
      setJustJoinedMap({}); // Clear local joined state
    }, 300); // Wait for animation
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY === 0) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY;
    
    if (diff > 0) {
      setTouchOffset(diff);
    }
    
    if (diff > 120) {
      closeSheet();
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

  useEffect(() => {
    // If unauthenticated and finished loading, redirect to login (or let them view map read-only?)
    // Let's redirect since the swipe feature requires auth
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    fetchProposals();
    checkUnreadRequests();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      fetchProposals();
      checkUnreadRequests();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchProposals = async () => {
    try {
      const res = await fetch("/api/map-events");
      const data = await res.json();
      if (data.proposals) {
        setProposals(data.proposals);
        // Also update selected proposal if it's currently open
        setSelectedProposal((prev: any) => {
          if (!prev) return null;
          const updated = data.proposals.find((p: any) => p.id === prev.id);
          return updated || prev;
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const checkUnreadRequests = async () => {
    try {
      const res = await fetch("/api/map-events/request");
      const data = await res.json();
      if (data.incomingPending && data.incomingPending.length > 0) {
        setHasUnreadRequests(true);
      } else {
        setHasUnreadRequests(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectProposal = (p: any) => {
    triggerHaptic('medium');
    setSelectedProposal(p);
    setIsSheetOpen(true);
  };

  const handleSwipeJoin = async () => {
    if (!selectedProposal) return;
    
    const proposalId = selectedProposal.id;

    try {
      const res = await fetch(`/api/map-events/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId })
      });
      if (res.ok) {
        setJustJoinedMap(prev => ({ ...prev, [proposalId]: true }));
        fetchProposals();
      } else {
        throw new Error("Failed to join");
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const joinClubEvent = async () => {
    if (!selectedProposal || selectedProposal.type !== "CLUB") throw new Error();
    try {
      const res = await fetch(`/api/events/${selectedProposal.event.id}/join`, { method: "POST" });
      if (res.ok) {
        fetchProposals();
      } else {
        throw new Error("Failed to join");
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const handleClubEventAction = async () => {
    if (!selectedProposal || selectedProposal.type !== "CLUB") throw new Error();
    
    if (!selectedProposal.isMember) {
      setShowClubJoinModal(true);
      throw new Error("Needs to join club");
    }
    
    await joinClubEvent();
  };

  const handleJoinClubAndEvent = async () => {
    setIsJoiningClub(true);
    try {
      const res = await fetch(`/api/clubs/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubId: selectedProposal.event.clubId, autoLeave: true })
      });
      if (res.ok) {
        setShowClubJoinModal(false);
        // Mark as member locally (optimistic)
        setSelectedProposal({...selectedProposal, isMember: true});
        const eventRes = await fetch(`/api/events/${selectedProposal.event.id}/join`, { method: "POST" });
        if (!eventRes.ok) {
          const eventData = await eventRes.json();
          alert(eventData.error || "Заявка в клуб отправлена, но присоединиться к событию пока нельзя.");
        }
        
        // Clear global cache so header updates club status
        const { globalCache } = await import("@/lib/cache");
        globalCache.clubs = null;
        globalCache.userData = null;
        
        fetchProposals();
        closeSheet();
      } else {
        const data = await res.json();
        alert(data.error || "Ошибка при вступлении в клуб");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsJoiningClub(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!selectedProposal) return;
    try {
      const res = await fetch(`/api/map-events/request?proposalId=${selectedProposal.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchProposals();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditClick = () => {
    if (!selectedProposal) return;
    const d = new Date(selectedProposal.startTime);
    
    // adjust for local timezone offset when getting YYYY-MM-DD
    const localDate = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    
    setEditDate(localDate);
    setEditTime(d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}));
    setEditPace(selectedProposal.pace || "");
    setEditLimit((selectedProposal.maxParticipants || 0).toString());
    setIsEditingProposal(true);
  };

  const handleDeleteProposal = async () => {
    if (!selectedProposal || !confirm("Точно удалить маячок?")) return;
    try {
      const res = await fetch(`/api/proposals/${selectedProposal.id}`, { method: "DELETE" });
      if (res.ok) {
        closeSheet();
        fetchProposals();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedProposal || !editDate || !editTime) return;
    setIsSubmittingEdit(true);
    try {
      const startTime = new Date(`${editDate}T${editTime}`).toISOString();
      const res = await fetch(`/api/proposals/${selectedProposal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime,
          pace: editPace,
          maxParticipants: parseInt(editLimit) || 0
        })
      });
      if (res.ok) {
        setIsEditingProposal(false);
        fetchProposals();
        closeSheet();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleMapClick = (latlng: any) => {
    // If they click empty space, go to create page with coords
    router.push(`/map/create?lat=${latlng.lat}&lng=${latlng.lng}`);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        setForceCenter([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        setIsSearching(false);
        setSearchQuery("");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const [triggerLocate, setTriggerLocate] = useState(0);

  const handleLocateMe = () => {
    triggerHaptic('light');
    setTriggerLocate(prev => prev + 1);

    // INSTANT FEEDBACK
    const saved = localStorage.getItem('lastKnownLocation');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length === 2) {
          setForceCenter([parsed[0], parsed[1]]);
        }
      } catch (e) {}
    }
  };

  const [activePinIndex, setActivePinIndex] = useState(-1);
  const [sortedProposals, setSortedProposals] = useState<any[]>([]);

  useEffect(() => {
    if (proposals.length === 0) return;
    
    const saved = localStorage.getItem('lastKnownLocation');
    let userLoc = [55.7558, 37.6173]; // fallback
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length === 2) userLoc = parsed;
      } catch (e) {}
    }

    const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371; 
      const dLat = (lat2-lat1) * Math.PI / 180;
      const dLon = (lon2-lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    };

    const sorted = [...proposals].sort((a, b) => {
      const distA = getDistance(userLoc[0], userLoc[1], a.lat, a.lng);
      const distB = getDistance(userLoc[0], userLoc[1], b.lat, b.lng);
      return distA - distB;
    });

    setSortedProposals(sorted);
    setActivePinIndex(-1); // Reset active pin when proposals change
  }, [proposals]);

  const cyclePins = (direction: 1 | -1) => {
    if (sortedProposals.length === 0) return;
    triggerHaptic('medium');
    let newIdx = activePinIndex + direction;
    if (newIdx < 0) newIdx = sortedProposals.length - 1;
    if (newIdx >= sortedProposals.length) newIdx = 0;
    
    setActivePinIndex(newIdx);
    const p = sortedProposals[newIdx];
    setForceCenter([p.lat, p.lng]);
    if (isSheetOpen) {
      closeSheet();
    }
  };

  return (
    <div className="absolute inset-0 bg-black text-foreground flex flex-col overflow-hidden">
      <TinderMap proposals={proposals} onSelectProposal={handleSelectProposal} onMapClick={handleMapClick} forceCenter={forceCenter} triggerLocate={triggerLocate} />

      {/* Top UI Overlay */}
      <div className="absolute top-0 left-0 w-full px-6 pb-6 pt-safe flex items-center pointer-events-none z-10 gap-3">
        {/* Search Input always visible */}
        <form onSubmit={handleSearch} className="flex-1 pointer-events-auto relative">
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Найти локацию..."
            className="w-full bg-black/40 backdrop-blur-md text-white border border-white/10 rounded-full pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-primary placeholder:text-white/50"
          />
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
        </form>

        <Link href="/map/requests" className="pointer-events-auto flex-shrink-0">
          <div className="relative w-12 h-12 bg-black/40 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center active:scale-95 transition-transform">
            <Bell size={24} />
            {hasUnreadRequests && (
              <div className="absolute top-3 right-3 w-3 h-3 bg-primary rounded-full border-2 border-black" />
            )}
          </div>
        </Link>
      </div>

      {/* Hint Tooltip */}
      <div className={`absolute top-safe mt-20 left-1/2 -translate-x-1/2 w-11/12 max-w-sm pointer-events-none z-10 transition-all duration-700 ease-in-out ${showHint ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="bg-black/60 backdrop-blur-md text-white/90 text-sm text-center py-3 px-4 rounded-2xl shadow-xl border border-white/10 flex items-center justify-center gap-2">
          <MapPin size={18} className="flex-shrink-0 text-primary" />
          <span className="leading-tight">Нажми в любое место на карте, чтобы назначить пробежку и собрать людей</span>
        </div>
      </div>

      {/* Pin Cycler Buttons (Left) */}
      <div className="absolute bottom-36 left-6 z-10 flex gap-2 pointer-events-auto">
        <button onClick={() => cyclePins(-1)} className="w-14 h-14 bg-card border border-border text-foreground rounded-full shadow-[0_0_20px_rgba(0,0,0,0.4)] flex items-center justify-center active:scale-95 transition-transform">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <button onClick={() => cyclePins(1)} className="w-14 h-14 bg-card border border-border text-foreground rounded-full shadow-[0_0_20px_rgba(0,0,0,0.4)] flex items-center justify-center active:scale-95 transition-transform">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>

      {/* Pin Cycler Buttons removed from bottom */}
      {/* FAB Locate Me Button */}
      <div className="absolute bottom-36 right-6 z-10">
        <button onClick={handleLocateMe} className="w-14 h-14 bg-primary text-black rounded-full shadow-[0_0_20px_rgba(204,255,0,0.4)] flex items-center justify-center active:scale-95 transition-transform pointer-events-auto">
          <LocateFixed size={28} />
        </button>
      </div>

      {/* Bottom Sheet */}
      <div 
        className={`absolute bottom-0 left-0 w-full bg-card border-t border-border rounded-t-[32px] p-6 pt-2 pb-32 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] ${touchOffset > 0 ? 'transition-none' : 'transition-transform duration-500 ease-in-out'}`}
        style={{ transform: isSheetOpen ? `translateY(${touchOffset}px)` : 'translateY(100%)' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="w-12 h-1.5 bg-muted/50 rounded-full mx-auto mb-6 cursor-pointer" onClick={closeSheet} />
        {selectedProposal && selectedProposal.type === "CLUB" ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-black font-black text-xl overflow-hidden shadow-[0_0_15px_rgba(204,255,0,0.3)]">
                {selectedProposal.event.club?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Клубная пробежка</span>
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-2xl font-black uppercase tracking-tight leading-none">{selectedProposal.event.title}</h2>
                  <button 
                    onClick={() => {
                      const botAppUrl = process.env.NEXT_PUBLIC_BOT_APP_URL;
                  const link = botAppUrl ? `${botAppUrl}?startapp=focus_${selectedProposal.id}` : `${window.location.origin}/?focus=${selectedProposal.id}`;
                  navigator.clipboard.writeText(link);
                      alert("Ссылка скопирована!");
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-primary/10 text-primary active:scale-95 transition-transform shrink-0"
                  >
                    <Share size={18} />
                  </button>
                </div>
                <span className="text-sm font-medium text-muted">{selectedProposal.event.club?.name}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="bg-muted/30 rounded-2xl p-4 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-muted">
                  <Clock size={16} />
                  <span className="text-xs uppercase font-bold tracking-wider">Старт</span>
                </div>
                <span className="font-bold text-lg">
                  {new Date(selectedProposal.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
                <span className="text-xs text-muted">
                  {new Date(selectedProposal.startTime).toLocaleDateString()}
                </span>
              </div>
              
              <div className="bg-muted/30 rounded-2xl p-4 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-muted">
                  <Activity size={16} />
                  <span className="text-xs uppercase font-bold tracking-wider">Темп</span>
                </div>
                <span className="font-bold text-lg">{selectedProposal.event.pace ? selectedProposal.event.pace.replace(/[\[\]"']/g, '').replace(/,/g, ' - ') : "—"}</span>
                <span className="text-xs text-muted">Дистанция: {selectedProposal.event.distance ? `${selectedProposal.event.distance} км` : "—"}</span>
              </div>
            </div>

            <div className="mt-4">
              {selectedProposal.event.attendees?.some((a: any) => a.id === (session?.user as any)?.id) ? (
                <div className="w-full h-16 flex items-center justify-center bg-primary text-black rounded-full font-black uppercase tracking-wider text-sm">
                  Вы участвуете! 🎉
                </div>
              ) : (
                <SwipeButton onConfirm={handleClubEventAction} successText="Вы участвуете!" />
              )}
            </div>
          </div>
        ) : selectedProposal && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black uppercase tracking-tight">Совместная пробежка</h2>
              <button 
                onClick={() => {
                  const botAppUrl = process.env.NEXT_PUBLIC_BOT_APP_URL;
                  const link = botAppUrl ? `${botAppUrl}?startapp=focus_${selectedProposal.id}` : `${window.location.origin}/?focus=${selectedProposal.id}`;
                  navigator.clipboard.writeText(link);
                  alert("Ссылка скопирована!");
                }}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-primary/10 text-primary active:scale-95 transition-transform shrink-0"
              >
                <Share size={18} />
              </button>
            </div>

            {isEditingProposal ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase font-bold tracking-wider pl-4 text-muted">Дата и время</label>
                  <div className="grid grid-cols-2 gap-4">
                    <input type="date" className="bg-muted/30 border-none outline-none rounded-2xl p-4 font-medium text-sm" value={editDate} onChange={e => setEditDate(e.target.value)} />
                    <input type="time" className="bg-muted/30 border-none outline-none rounded-2xl p-4 font-medium text-sm" value={editTime} onChange={e => setEditTime(e.target.value)} />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase font-bold tracking-wider pl-4 text-muted">Темп (мин/км)</label>
                  <input type="text" placeholder="Например: 5:30 или 5:00 - 6:00" className="bg-muted/30 border-none outline-none rounded-2xl p-4 font-medium text-sm w-full" value={editPace} onChange={e => setEditPace(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase font-bold tracking-wider pl-4 text-muted">Лимит участников (0 = безлимит)</label>
                  <input type="number" min="0" className="bg-muted/30 border-none outline-none rounded-2xl p-4 font-medium text-sm w-full" value={editLimit} onChange={e => setEditLimit(e.target.value)} />
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <button onClick={() => setIsEditingProposal(false)} disabled={isSubmittingEdit} className="py-4 bg-muted text-foreground rounded-2xl font-bold uppercase tracking-wider active:scale-95 transition-transform disabled:opacity-50 text-sm">
                    Отмена
                  </button>
                  <button onClick={handleSaveEdit} disabled={isSubmittingEdit} className="py-4 bg-primary text-black rounded-2xl font-bold uppercase tracking-wider active:scale-95 transition-transform disabled:opacity-50 text-sm">
                    {isSubmittingEdit ? "Сохранение..." : "Сохранить"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/30 rounded-2xl p-4 flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-muted">
                      <Clock size={16} />
                      <span className="text-xs uppercase font-bold tracking-wider">Старт</span>
                    </div>
                    <span className="font-bold text-lg">
                      {new Date(selectedProposal.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                    <span className="text-xs text-muted">
                      {new Date(selectedProposal.startTime).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="bg-muted/30 rounded-2xl p-4 flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-muted">
                      <Activity size={16} />
                      <span className="text-xs uppercase font-bold tracking-wider">Темп</span>
                    </div>
                    <span className="font-bold text-lg">{selectedProposal.pace ? selectedProposal.pace.replace(/[\[\]"']/g, '').replace(/,/g, ' - ') : "Любой"}</span>
                    <span className="text-xs text-muted">мин/км</span>
                  </div>
                </div>

                {selectedProposal.address && (
                  <div className="bg-muted/30 rounded-2xl p-4 flex items-center gap-3">
                    <MapPin size={20} className="text-primary flex-shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted mb-0.5">Локация</span>
                      <span className="font-medium text-sm leading-tight">{selectedProposal.address}</span>
                    </div>
                  </div>
                )}

                <div className="bg-muted/30 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users size={20} className="text-primary" />
                    <span className="font-medium text-sm">Участники</span>
                  </div>
                  <span className="font-black">
                    {selectedProposal._count?.requests || 0} / {selectedProposal.maxParticipants === 0 ? '∞' : selectedProposal.maxParticipants}
                  </span>
                </div>

                <div className="mt-2">
                  {justJoinedMap[selectedProposal.id] ? (
                    <div className="w-full h-16 flex items-center justify-center rounded-full bg-primary text-black font-black uppercase tracking-wider text-sm pointer-events-none">
                      Запрос ожидает ответа
                    </div>
                  ) : (selectedProposal.requests && selectedProposal.requests.length > 0) ? (
                    selectedProposal.requests[0].status === "REJECTED" ? (
                      <div className="w-full h-16 flex items-center justify-center rounded-full bg-red-500/10 text-red-500 font-black uppercase tracking-wider text-sm pointer-events-none border border-red-500/20">
                        Организатор отклонил заявку
                      </div>
                    ) : selectedProposal.requests[0].status === "CANCELLED" ? (
                      <div className="w-full h-16 flex items-center justify-center rounded-full bg-muted text-muted-foreground font-black uppercase tracking-wider text-sm pointer-events-none border border-border">
                        Вы отменили участие
                      </div>
                    ) : (
                      <SwipeButton 
                        key="cancel"
                        variant="cancel" 
                        onConfirm={handleCancelRequest} 
                        text={selectedProposal.requests[0].status === "ACCEPTED" ? "Отменить участие" : "Отменить запрос"} 
                        successText="Отменено" 
                      />
                    )
                  ) : selectedProposal.creator?.id === (session?.user as any)?.id ? (
                    <div className="grid grid-cols-2 gap-4">
                      <button onClick={handleDeleteProposal} className="py-4 bg-red-500/10 text-red-500 rounded-2xl font-bold uppercase tracking-wider active:scale-95 transition-transform text-sm">
                        Удалить
                      </button>
                      <button onClick={handleEditClick} className="py-4 bg-primary/20 text-primary rounded-2xl font-bold uppercase tracking-wider active:scale-95 transition-transform text-sm">
                        Изменить
                      </button>
                    </div>
                  ) : (
                    <SwipeButton key="join" onConfirm={handleSwipeJoin} successText="Запрос ожидает ответа" />
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Join Club Modal */}
      {showClubJoinModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1c] border border-border rounded-[32px] p-6 w-full max-w-sm flex flex-col gap-6">
            <div className="flex flex-col gap-2 text-center items-center">
              <div className="w-16 h-16 rounded-[20px] bg-primary flex items-center justify-center text-black mb-2">
                <Users size={32} />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">Вступление в клуб</h3>
              <p className="text-sm text-muted">Вступи в клуб чтобы пойти на пробежку и километры засчитались в битве.</p>
            </div>
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleJoinClubAndEvent} 
                disabled={isJoiningClub}
                className="w-full py-4 bg-primary text-black rounded-2xl font-bold uppercase tracking-wider text-sm active:scale-95 transition-transform disabled:opacity-50"
              >
                {isJoiningClub ? "Вступаем..." : "Вступить и пойти"}
              </button>
              <button 
                onClick={() => setShowClubJoinModal(false)}
                className="w-full py-4 bg-muted text-foreground rounded-2xl font-bold uppercase tracking-wider text-sm active:scale-95 transition-transform"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<div className="w-full h-[100dvh] bg-black flex items-center justify-center text-primary font-mono text-sm">ЗАГРУЗКА КАРТЫ...</div>}>
      <MapContent />
    </Suspense>
  );
}
