"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Bell, MapPin, Clock, Users, X, Search, Activity, ArrowLeft, LocateFixed } from "lucide-react";
import { SwipeButton } from "@/components/SwipeButton";
import { triggerHaptic } from "@/lib/haptics";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const TinderMap = dynamic(() => import("@/components/TinderMap"), { ssr: false });

export default function MapPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [proposals, setProposals] = useState<any[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<any | null>(null);
  const [hasUnreadRequests, setHasUnreadRequests] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [forceCenter, setForceCenter] = useState<[number, number] | null>(null);
  const [touchStartY, setTouchStartY] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY === 0) return;
    const currentY = e.touches[0].clientY;
    if (currentY - touchStartY > 50) {
      setSelectedProposal(null);
      setTouchStartY(0);
    }
  };

  useEffect(() => {
    // If unauthenticated and finished loading, redirect to login (or let them view map read-only?)
    // Let's redirect since the swipe feature requires auth
    if (status === "unauthenticated") {
      router.push("/login");
    }

    // Hide BottomNav on this screen
    window.dispatchEvent(new Event("hideNav"));
    return () => {
      window.dispatchEvent(new Event("showNav"));
    };
  }, [status, router]);

  useEffect(() => {
    fetchProposals();
    checkUnreadRequests();
  }, []);

  const fetchProposals = async () => {
    try {
      const res = await fetch("/api/map-events");
      const data = await res.json();
      if (data.proposals) setProposals(data.proposals);
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
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectProposal = (p: any) => {
    triggerHaptic('medium');
    setSelectedProposal(p);
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
        fetchProposals();
        // Wait a bit so the user can see the "Запрос отправлен" text on the button
        await new Promise(resolve => setTimeout(resolve, 800));
        setSelectedProposal(null);
      } else {
        // If it failed (e.g. already requested), we can also just close it
        await new Promise(resolve => setTimeout(resolve, 800));
        setSelectedProposal(null);
      }
    } catch (e) {
      console.error(e);
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

  const handleLocateMe = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setForceCenter([pos.coords.latitude, pos.coords.longitude]);
      }, (err) => {
        console.error("Error getting location", err);
      });
    }
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-black text-foreground">
      <TinderMap proposals={proposals} onSelectProposal={handleSelectProposal} onMapClick={handleMapClick} forceCenter={forceCenter} />

      {/* Top UI Overlay */}
      <div className="absolute top-0 left-0 w-full p-6 pt-12 flex justify-between items-center pointer-events-none z-10 gap-3">
        <button 
          onClick={() => router.back()} 
          className="bg-black/40 flex-shrink-0 backdrop-blur-md rounded-full w-12 h-12 flex items-center justify-center border border-white/10 pointer-events-auto active:scale-95 transition-transform"
        >
          <ArrowLeft size={24} />
        </button>

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

      {/* FAB Locate Me Button */}
      <div className="absolute bottom-24 right-6 z-10">
        <button onClick={handleLocateMe} className="w-14 h-14 bg-primary text-black rounded-full shadow-[0_0_20px_rgba(204,255,0,0.4)] flex items-center justify-center active:scale-95 transition-transform pointer-events-auto">
          <LocateFixed size={28} />
        </button>
      </div>

      {/* Bottom Sheet */}
      <div 
        className={`absolute bottom-0 left-0 w-full bg-card border-t border-border rounded-t-[32px] p-6 pt-2 pb-24 transition-transform duration-500 ease-out z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] ${selectedProposal ? 'translate-y-0' : 'translate-y-full'}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        <div className="w-12 h-1.5 bg-muted/50 rounded-full mx-auto mb-6 cursor-pointer" onClick={() => setSelectedProposal(null)} />
        {selectedProposal && (
          <div className="flex flex-col gap-6">
            <h2 className="text-2xl font-black uppercase tracking-tight">Совместная пробежка</h2>

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
                <span className="font-bold text-lg">{selectedProposal.pace || "Любой"}</span>
                <span className="text-xs text-muted">мин/км</span>
              </div>
            </div>

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
              {selectedProposal.requests && selectedProposal.requests.length > 0 ? (
                <div className="w-full py-4 text-center bg-muted/50 rounded-2xl font-bold uppercase tracking-wider text-sm">
                  {selectedProposal.requests[0].status === "PENDING" ? "Запрос ожидает ответа" : 
                   selectedProposal.requests[0].status === "ACCEPTED" ? "Вы участвуете! 🎉" : 
                   "Заявка отклонена"}
                </div>
              ) : selectedProposal.creator?.id === (session?.user as any)?.id ? (
                <div className="w-full py-4 text-center bg-muted/50 rounded-2xl font-bold uppercase tracking-wider text-sm">
                  Ваша пробежка
                </div>
              ) : (
                <SwipeButton onConfirm={handleSwipeJoin} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
