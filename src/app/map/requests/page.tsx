"use client";
import { useState, useEffect } from "react";
import { ArrowLeft, Check, X, Loader2, Send, MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { triggerHaptic } from "@/lib/haptics";

export default function RequestsInbox() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"REQUESTS" | "MATCHES">("REQUESTS");
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>({ incomingPending: [], matches: { asCreator: [], asParticipant: [] } });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/map-events/request");
      const json = await res.json();
      if (json.incomingPending) {
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (requestId: string, status: "ACCEPTED" | "REJECTED") => {
    triggerHaptic('medium');
    try {
      // Optimistic update
      setData((prev: any) => ({
        ...prev,
        incomingPending: prev.incomingPending.filter((r: any) => r.id !== requestId)
      }));

      await fetch("/api/map-events/request", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, status })
      });
      
      if (status === "ACCEPTED") {
        fetchData(); // reload to get it into matches
      }
    } catch (e) {
      console.error(e);
    }
  };

  const allMatches = [
    ...(data.matches.asCreator || []).map((m: any) => ({ ...m, isCreatorRole: true })),
    ...(data.matches.asParticipant || []).map((m: any) => ({ ...m, isCreatorRole: false }))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="flex flex-col min-h-[100dvh] bg-black text-foreground">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 pb-4 pt-safe border-b border-border sticky top-0 bg-black/80 backdrop-blur-md z-20">
        <h1 className="text-2xl font-black uppercase tracking-tight">Уведомления</h1>
      </div>

      {/* Tabs */}
      <div className="flex p-4 gap-2">
        <button 
          onClick={() => { triggerHaptic('light'); setActiveTab("REQUESTS"); }}
          className={`flex-1 py-3 rounded-full font-bold text-sm uppercase tracking-wider transition-colors ${activeTab === "REQUESTS" ? "bg-primary text-black" : "bg-card text-muted"}`}
        >
          Запросы {data.incomingPending.length > 0 && `(${data.incomingPending.length})`}
        </button>
        <button 
          onClick={() => { triggerHaptic('light'); setActiveTab("MATCHES"); }}
          className={`flex-1 py-3 rounded-full font-bold text-sm uppercase tracking-wider transition-colors ${activeTab === "MATCHES" ? "bg-primary text-black" : "bg-card text-muted"}`}
        >
          Мэтчи {allMatches.length > 0 && `(${allMatches.length})`}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" size={32} /></div>
        ) : activeTab === "REQUESTS" ? (
          <div className="flex flex-col gap-4">
            {data.incomingPending.length === 0 ? (
              <div className="text-center text-muted py-10">Новых запросов пока нет</div>
            ) : (
              data.incomingPending.map((req: any) => (
                <div key={req.id} className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-muted overflow-hidden flex-shrink-0">
                      {req.user.image ? (
                        <Image src={req.user.image} alt={req.user.name} width={48} height={48} className="object-cover w-full h-full" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl font-bold">{req.user.name?.[0]}</div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold">{req.user.name}</h3>
                      <p className="text-xs text-muted">Пробежал: {(req.user.totalDistance || 0).toFixed(1)} км</p>
                    </div>
                    <div className="flex gap-2">
                      {req.user.telegramUsername && (
                        <Link href={`https://t.me/${req.user.telegramUsername.replace('@', '')}`} target="_blank">
                          <button className="w-12 h-12 bg-[#0088cc] text-white rounded-full flex items-center justify-center active:scale-95 transition-transform flex-shrink-0">
                            <Send size={20} className="relative right-0.5" />
                          </button>
                        </Link>
                      )}
                      <Link href={`/?lat=${req.proposal.lat}&lng=${req.proposal.lng}&focus=${req.proposal.id}`}>
                        <button className="w-12 h-12 bg-card border border-border text-primary rounded-full flex items-center justify-center active:scale-95 transition-transform flex-shrink-0">
                          <MapPin size={22} />
                        </button>
                      </Link>
                    </div>
                  </div>
                  
                  <div className="bg-background rounded-xl p-3 flex justify-between items-center text-sm">
                    <span className="text-muted">Пробежка:</span>
                    <span className="font-bold">{new Date(req.proposal.startTime).toLocaleDateString()} в {new Date(req.proposal.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => handleAction(req.id, "REJECTED")} className="flex-1 py-3 bg-card border border-border text-foreground rounded-xl font-bold flex justify-center active:scale-95 transition-transform">
                      <X size={20} />
                    </button>
                    <button onClick={() => handleAction(req.id, "ACCEPTED")} className="flex-1 py-3 bg-primary text-black rounded-xl font-bold flex justify-center active:scale-95 transition-transform">
                      <Check size={20} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {allMatches.length === 0 ? (
              <div className="text-center text-muted py-10">У вас пока нет мэтчей</div>
            ) : (
              allMatches.map((match: any) => {
                // Determine if I am creator or participant
                const otherUser = match.isCreatorRole ? match.user : match.proposal.creator;
                
                return (
                  <div key={match.id} className="bg-card border border-primary/30 rounded-2xl p-4 flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-muted overflow-hidden flex-shrink-0 relative">
                        {otherUser.image ? (
                          <Image src={otherUser.image} alt={otherUser.name} width={48} height={48} className="object-cover w-full h-full" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xl font-bold">{otherUser.name?.[0]}</div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold">{otherUser.name}</h3>
                        <p className="text-xs text-primary font-mono">{otherUser.telegramUsername || "Скрыт"}</p>
                      </div>
                      
                      <div className="flex gap-2">
                        {otherUser.telegramUsername && (
                          <Link href={`https://t.me/${otherUser.telegramUsername.replace('@', '')}`} target="_blank">
                            <button className="w-12 h-12 bg-[#0088cc] text-white rounded-full flex items-center justify-center active:scale-95 transition-transform flex-shrink-0">
                              <Send size={20} className="relative right-0.5" />
                            </button>
                          </Link>
                        )}
                        <Link href={`/?lat=${match.proposal.lat}&lng=${match.proposal.lng}&focus=${match.proposal.id}`}>
                          <button className="w-12 h-12 bg-card border border-border text-primary rounded-full flex items-center justify-center active:scale-95 transition-transform flex-shrink-0">
                            <MapPin size={22} />
                          </button>
                        </Link>
                      </div>
                    </div>
                    
                    <div className="bg-background rounded-xl p-3 flex justify-between items-center text-sm">
                      <span className="text-muted">Пробежка:</span>
                      <span className="font-bold">{new Date(match.proposal.startTime).toLocaleDateString()} в {new Date(match.proposal.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
