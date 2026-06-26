"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Bell, MapPin, Clock, Users, X, Plus, Activity } from "lucide-react";
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
    
    const res = await fetch("/api/map-events/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposalId: selectedProposal.id })
    });
    
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error);
    }
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-black text-foreground">
      {/* Map Background */}
      <TinderMap proposals={proposals} onSelectProposal={handleSelectProposal} />

      {/* Top UI Overlay */}
      <div className="absolute top-0 left-0 w-full p-6 pt-12 flex justify-between items-start pointer-events-none z-10">
        <div className="bg-black/40 backdrop-blur-md rounded-full px-4 py-2 border border-white/10 pointer-events-auto">
          <h1 className="font-black tracking-tight uppercase text-lg">Карта</h1>
        </div>

        <Link href="/map/requests" className="pointer-events-auto">
          <div className="relative w-12 h-12 bg-black/40 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center active:scale-95 transition-transform">
            <Bell size={24} />
            {hasUnreadRequests && (
              <div className="absolute top-3 right-3 w-3 h-3 bg-primary rounded-full border-2 border-black" />
            )}
          </div>
        </Link>
      </div>

      {/* FAB to create run */}
      <div className="absolute bottom-24 right-6 z-10">
        <Link href="/map/create">
          <div className="w-14 h-14 bg-primary text-black rounded-full shadow-[0_0_20px_rgba(204,255,0,0.4)] flex items-center justify-center active:scale-90 transition-transform">
            <Plus size={32} />
          </div>
        </Link>
      </div>

      {/* Bottom Sheet */}
      <div 
        className={`absolute bottom-0 left-0 w-full bg-card border-t border-border rounded-t-[32px] p-6 pb-24 transition-transform duration-500 ease-out z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] ${selectedProposal ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {selectedProposal && (
          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-start">
              <h2 className="text-2xl font-black uppercase tracking-tight">Совместная пробежка</h2>
              <button onClick={() => setSelectedProposal(null)} className="p-2 bg-muted/50 rounded-full active:scale-90">
                <X size={20} />
              </button>
            </div>

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
              <SwipeButton onConfirm={handleSwipeJoin} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
