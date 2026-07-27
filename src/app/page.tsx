"use client";
import { Suspense, useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Bell, MapPin, Clock, Users, X, Search, Activity, ArrowLeft, LocateFixed, Share, Plus, Minus, Calendar, Loader2 } from "lucide-react";
import { SwipeButton } from "@/components/SwipeButton";
import { triggerHaptic } from "@/lib/haptics";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { PaceRangeSlider, paceRangeToString, parsePaceRange } from "@/components/PaceRangeSlider";

function ParticipantStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="bg-card border border-border rounded-2xl flex items-center justify-between p-2">
      <button
        type="button"
        onClick={() => { triggerHaptic("light"); onChange(Math.max(0, value - 1)); }}
        className="w-11 h-11 flex items-center justify-center rounded-xl bg-muted/20 text-foreground active:scale-95 transition-transform"
      >
        <Minus size={18} />
      </button>
      <span className="font-black text-lg">{value === 0 ? "Без лимита" : value}</span>
      <button
        type="button"
        onClick={() => { triggerHaptic("light"); onChange(value + 1); }}
        className="w-11 h-11 flex items-center justify-center rounded-xl bg-primary/20 text-primary active:scale-95 transition-transform"
      >
        <Plus size={18} />
      </button>
    </div>
  );
}

function DateTimeCard({ date, time, onDate, onTime }: { date: string; time: string; onDate: (v: string) => void; onTime: (v: string) => void }) {
  return (
    <div className="bg-card border border-border rounded-2xl flex items-stretch divide-x divide-border overflow-hidden">
      <div className="flex-1 flex items-center gap-2 p-3 relative focus-within:bg-primary/5 transition-colors">
        <Calendar size={16} className="text-primary shrink-0" />
        <input
          type="date"
          value={date}
          onChange={(e) => onDate(e.target.value)}
          required
          className="bg-transparent border-none outline-none w-full font-medium text-sm cursor-pointer"
        />
      </div>
      <div className="flex-1 flex items-center gap-2 p-3 relative focus-within:bg-primary/5 transition-colors">
        <Clock size={16} className="text-primary shrink-0" />
        <input
          type="time"
          value={time}
          onChange={(e) => onTime(e.target.value)}
          required
          className="bg-transparent border-none outline-none w-full font-medium text-sm cursor-pointer"
        />
      </div>
    </div>
  );
}

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
  const lastFocusedId = useRef<string | null>(null);
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
      if (p && lastFocusedId.current !== focusId) {
        lastFocusedId.current = focusId;
        setForceCenter([p.lat, p.lng]);
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
  const [editPaceFrom, setEditPaceFrom] = useState(5);
  const [editPaceTo, setEditPaceTo] = useState(6);
  const [editPaceAny, setEditPaceAny] = useState(true);
  const [justJoinedMap, setJustJoinedMap] = useState<Record<string, boolean>>({});
  const [editLimit, setEditLimit] = useState(0);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // --- Create Proposal (draft pin dropped on the map) ---
  const [isCreatingProposal, setIsCreatingProposal] = useState(false);
  const [createPosition, setCreatePosition] = useState<[number, number] | null>(null);
  const [createAddress, setCreateAddress] = useState("");
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  const [createDate, setCreateDate] = useState("");
  const [createTime, setCreateTime] = useState("");
  const [createPaceFrom, setCreatePaceFrom] = useState(5);
  const [createPaceTo, setCreatePaceTo] = useState(6);
  const [createPaceAny, setCreatePaceAny] = useState(true);
  const [createLimit, setCreateLimit] = useState(0);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  const addressEditedRef = useRef(false);

  useEffect(() => {
    if (!isCreatingProposal || !createPosition) return;
    addressEditedRef.current = false;
    setIsFetchingAddress(true);
    const timer = setTimeout(async () => {
      try {
        // The exact tapped point often has no building/road tagged in OSM at high zoom.
        // Walk down through zoom levels (building -> street -> area) and keep the most
        // precise label that at least has a street name, without moving the pin itself.
        const zooms = [18, 17, 16, 14, 10];
        let resolved: string | null = null;
        let fallback: string | null = null;
        for (const zoom of zooms) {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${createPosition[0]}&lon=${createPosition[1]}&zoom=${zoom}&accept-language=ru`);
          const data = await res.json();
          const a = data?.address;
          if (a) {
            const parts = [a.city || a.town || a.village, a.road, a.house_number].filter(Boolean);
            const label = parts.length > 0 ? parts.join(", ") : data.display_name;
            if (!fallback && label) fallback = label;
            if (a.road) { resolved = label; break; }
          }
        }
        if (!addressEditedRef.current) {
          setCreateAddress(resolved || fallback || "Адрес не найден");
        }
      } catch (e) {
        if (!addressEditedRef.current) setCreateAddress("Ошибка сети");
      } finally {
        setIsFetchingAddress(false);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [createPosition, isCreatingProposal]);

  const startCreatingProposal = (latlng: { lat: number; lng: number }) => {
    triggerHaptic('medium');
    setCreatePosition([latlng.lat, latlng.lng]);
    setCreateAddress("");
    setCreateDate("");
    setCreateTime("");
    setCreatePaceFrom(5);
    setCreatePaceTo(6);
    setCreatePaceAny(true);
    setCreateLimit(0);
    setIsCreatingProposal(true);
    setIsSheetOpen(true);
  };

  const handleCreateSubmit = async () => {
    if (!createPosition || !createDate || !createTime) return;
    triggerHaptic('medium');
    setIsSubmittingCreate(true);
    try {
      const startTime = new Date(`${createDate}T${createTime}`).toISOString();
      const res = await fetch("/api/map-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: createPosition[0],
          lng: createPosition[1],
          address: createAddress,
          pace: createPaceAny ? null : paceRangeToString(createPaceFrom, createPaceTo),
          startTime,
          maxParticipants: createLimit
        })
      });
      if (res.ok) {
        closeSheet();
        fetchProposals();
      } else {
        const data = await res.json();
        alert(data.error || "Произошла ошибка при создании пробежки");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  useEffect(() => {
    // Show the hint every time the map is opened
    setShowHint(true);
    const timer = setTimeout(() => {
      setShowHint(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    window.dispatchEvent(new Event(isSheetOpen ? 'hideNav' : 'showNav'));
    return () => { window.dispatchEvent(new Event('showNav')); };
  }, [isSheetOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
    setTouchOffset(0);
  };

  const closeSheet = () => {
    setIsSheetOpen(false);
    setTimeout(() => {
      setSelectedProposal(null);
      setIsEditingProposal(false);
      setIsCreatingProposal(false);
      setCreatePosition(null);
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
        
        // Check if focused run is missing (expired)
        const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
        const startParam = tg?.initDataUnsafe?.start_param;
        let focusId = null;
        if (typeof window !== 'undefined') {
          focusId = new URLSearchParams(window.location.search).get('focus');
        }
        if (startParam && startParam.startsWith('focus_')) {
          focusId = startParam.replace('focus_', '');
        }

        if (focusId && lastFocusedId.current !== focusId) {
          const p = data.proposals.find((pr: any) => pr.id === focusId);
          if (!p) {
            lastFocusedId.current = focusId; // prevent infinite alert loop
            if (tg && tg.showAlert) {
              tg.showAlert("Эта пробежка уже прошла! 🏁");
            } else if (typeof window !== 'undefined') {
              alert("Эта пробежка уже прошла! 🏁");
            }
          }
        }

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
        const { globalCache } = await import("@/lib/cache");
        fetch('/api/events').then(r => r.json()).then(d => {
          if (d.events) globalCache.events = d.events;
        }).catch(() => {});
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
        fetch('/api/events').then(r => r.json()).then(d => {
          if (d.events) globalCache.events = d.events;
        }).catch(() => {});
        
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
    const [pFrom, pTo] = parsePaceRange(selectedProposal.pace);
    setEditPaceFrom(pFrom);
    setEditPaceTo(pTo);
    setEditPaceAny(!selectedProposal.pace);
    setEditLimit(selectedProposal.maxParticipants || 0);
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
          pace: editPaceAny ? null : paceRangeToString(editPaceFrom, editPaceTo),
          maxParticipants: editLimit
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
    if (isCreatingProposal) {
      // Move the draft pin instead of starting a new one
      setCreatePosition([latlng.lat, latlng.lng]);
      return;
    }
    if (selectedProposal) return; // ignore taps while viewing another proposal
    startCreatingProposal(latlng);
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
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  const handleLocateMe = () => {
    triggerHaptic('light');
    if (userLocation) {
      setForceCenter([...userLocation]);
    } else {
      setTriggerLocate(prev => prev + 1);
    }
  };

  const handleLocationFound = (coords: [number, number]) => {
    setUserLocation(coords);
  };

  const [activePinIndex, setActivePinIndex] = useState(-1);
  const [sortedProposals, setSortedProposals] = useState<any[]>([]);

  useEffect(() => {
    if (proposals.length === 0) return;
    
    const MOSCOW: [number, number] = [55.7558, 37.6173];
    const userLoc = userLocation ?? MOSCOW;

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
  }, [proposals, userLocation]);

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
      <TinderMap proposals={proposals} onSelectProposal={handleSelectProposal} onMapClick={handleMapClick} forceCenter={forceCenter} triggerLocate={triggerLocate} onLocationFound={handleLocationFound} draftPosition={createPosition} />

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
        className={`absolute bottom-0 left-0 w-full bg-card border-t border-border rounded-t-[32px] p-6 pt-2 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] ${touchOffset > 0 ? 'transition-none' : 'transition-transform duration-500 ease-in-out'}`}
        style={{ transform: isSheetOpen ? `translateY(${touchOffset}px)` : 'translateY(100%)', paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="w-12 h-1.5 bg-muted/50 rounded-full mx-auto mb-6 cursor-pointer" onClick={closeSheet} />
        {isCreatingProposal ? (
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-black uppercase tracking-tight">Новый маячок</h2>

            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase font-bold tracking-wider pl-4 text-muted flex items-center gap-2">
                <Clock size={16} /> Дата и время старта
              </label>
              <DateTimeCard date={createDate} time={createTime} onDate={setCreateDate} onTime={setCreateTime} />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-muted uppercase tracking-widest pl-4">Локация</label>
              <div className="bg-card border border-border rounded-2xl flex items-center p-3 gap-3 focus-within:border-primary transition-colors">
                {isFetchingAddress ? (
                  <Loader2 size={18} className="text-primary animate-spin shrink-0" />
                ) : (
                  <MapPin size={18} className="text-primary shrink-0" />
                )}
                <input
                  type="text"
                  value={createAddress}
                  onChange={(e) => { addressEditedRef.current = true; setCreateAddress(e.target.value); }}
                  placeholder="Тапни по карте или впиши адрес вручную"
                  className="bg-transparent border-none outline-none w-full font-medium text-sm"
                />
              </div>
            </div>

            <PaceRangeSlider
              from={createPaceFrom}
              to={createPaceTo}
              onChange={(f, t) => { setCreatePaceFrom(f); setCreatePaceTo(t); }}
              paceAny={createPaceAny}
              onPaceAnyChange={setCreatePaceAny}
            />

            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase font-bold tracking-wider pl-4 text-muted flex items-center gap-2">
                <Users size={16} /> Лимит участников
              </label>
              <ParticipantStepper value={createLimit} onChange={setCreateLimit} />
            </div>

            <div className="grid grid-cols-2 gap-4 mt-2">
              <button onClick={closeSheet} disabled={isSubmittingCreate} className="py-3 bg-muted text-foreground rounded-2xl font-bold uppercase tracking-wider active:scale-95 transition-transform disabled:opacity-50 text-sm">
                Отмена
              </button>
              <button onClick={handleCreateSubmit} disabled={isSubmittingCreate || !createDate || !createTime} className="py-3 bg-primary text-black rounded-2xl font-black uppercase tracking-wider active:scale-95 transition-transform disabled:opacity-50 text-sm">
                {isSubmittingCreate ? <Loader2 className="animate-spin mx-auto" size={18} /> : "Поставить маячок"}
              </button>
            </div>
          </div>
        ) : selectedProposal && selectedProposal.type === "CLUB" ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between w-full mb-4 gap-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-black font-black text-xl overflow-hidden shadow-[0_0_15px_rgba(204,255,0,0.3)] shrink-0">
                  {selectedProposal.event.club?.name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Клубная пробежка</span>
                  <h2 className="text-2xl font-black uppercase tracking-tight leading-none mt-0.5">{selectedProposal.event.title}</h2>
                  <span className="text-sm font-medium text-muted mt-0.5">{selectedProposal.event.club?.name}</span>
                </div>
              </div>
              <button 
                onClick={() => {
                  const botAppUrl = process.env.NEXT_PUBLIC_BOT_APP_URL;
                  const link = botAppUrl ? `${botAppUrl}?startapp=focus_${selectedProposal.id}` : `${window.location.origin}/?focus=${selectedProposal.id}`;
                  navigator.clipboard.writeText(link);
                  alert("Ссылка скопирована!");
                }}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-primary/10 text-primary active:scale-95 transition-transform shrink-0 mt-1"
              >
                <Share size={18} />
              </button>
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
                <span className="font-bold text-lg">
                  {(() => {
                    const rawPace = selectedProposal.event.pace;
                    const paceArr = Array.isArray(rawPace) ? rawPace : (typeof rawPace === 'string' ? rawPace.replace(/[\[\]"']/g, '').split(',').filter(Boolean) : []);
                    return paceArr.length > 0 ? paceArr.join(' - ') : "Любой";
                  })()}
                </span>
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
                  <label className="text-xs uppercase font-bold tracking-wider pl-4 text-muted flex items-center gap-2">
                    <Clock size={16} /> Дата и время старта
                  </label>
                  <DateTimeCard date={editDate} time={editTime} onDate={setEditDate} onTime={setEditTime} />
                </div>

                <PaceRangeSlider
                  from={editPaceFrom}
                  to={editPaceTo}
                  onChange={(f, t) => { setEditPaceFrom(f); setEditPaceTo(t); }}
                  paceAny={editPaceAny}
                  onPaceAnyChange={setEditPaceAny}
                />

                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase font-bold tracking-wider pl-4 text-muted flex items-center gap-2">
                    <Users size={16} /> Лимит участников
                  </label>
                  <ParticipantStepper value={editLimit} onChange={setEditLimit} />
                </div>

                <div className="grid grid-cols-2 gap-4 mt-2">
                  <button onClick={() => setIsEditingProposal(false)} disabled={isSubmittingEdit} className="py-3 bg-muted text-foreground rounded-2xl font-bold uppercase tracking-wider active:scale-95 transition-transform disabled:opacity-50 text-sm">
                    Отмена
                  </button>
                  <button onClick={handleSaveEdit} disabled={isSubmittingEdit} className="py-3 bg-primary text-black rounded-2xl font-bold uppercase tracking-wider active:scale-95 transition-transform disabled:opacity-50 text-sm">
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
