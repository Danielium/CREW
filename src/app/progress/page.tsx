"use client";
import { useState, useEffect } from "react";
import { Timer, Calendar, ChevronRight, X, Loader2, Plus, MapPin, Footprints, Trophy } from "lucide-react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";

const RunRouteMap = dynamic(() => import("@/components/RunRouteMap"), { ssr: false });

export default function ProgressTab() {
  const { data: session } = useSession();
  const [userData, setUserData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState<any>(null);

  useEffect(() => {
    if (session?.user) {
      fetchUserData();
    } else {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (selectedRun) {
      window.dispatchEvent(new Event("hideNav"));
    } else {
      window.dispatchEvent(new Event("showNav"));
    }
    // Cleanup on unmount
    return () => {
      window.dispatchEvent(new Event("showNav"));
    };
  }, [selectedRun]);

  const fetchUserData = async () => {
    try {
      const res = await fetch(`/api/users?userId=${(session?.user as any).id}`);
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

  const formatPace = (pace: number) => {
    if (!pace || !isFinite(pace)) return "--:--";
    const min = Math.floor(pace);
    const sec = Math.floor((pace - min) * 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (d.toDateString() === today.toDateString()) return "Сегодня";
    if (d.toDateString() === yesterday.toDateString()) return "Вчера";
    
    return d.toLocaleDateString("ru-RU", { day: 'numeric', month: 'long' });
  };

  if (isLoading) {
    return <div className="min-h-screen flex justify-center items-center"><Loader2 size={32} className="animate-spin text-primary" /></div>;
  }


  const totalKm = userData?.totalDistance || 0;
  const runs = userData?.runs || [];
  const runsCount = runs.length;
  
  let avgPaceSum = 0;
  let runsWithPace = 0;
  runs.forEach((r: any) => {
    if (r.avgPace > 0) {
      avgPaceSum += r.avgPace;
      runsWithPace++;
    }
  });
  const avgPace = runsWithPace > 0 ? avgPaceSum / runsWithPace : 0;

  return (
    <div className="flex flex-col min-h-[100dvh] text-foreground pb-24 relative z-10">
      {/* Header Sticky */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-black tracking-tight uppercase">Прогресс</h1>
      </div>

      <div className="flex flex-col gap-6 px-4 mt-6">
        {/* Running Stats Overview */}
        <div className="bg-card rounded-[24px] border border-border overflow-hidden shadow-lg grid grid-cols-2 divide-x divide-border bg-gradient-to-b from-card to-background/50">
          <div className="p-6 flex flex-col items-center justify-center text-center">
            <p className="text-muted text-[10px] font-bold uppercase tracking-widest mb-1">Дистанция</p>
            <h3 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-[#80ff00]">
              {totalKm.toFixed(1)}<span className="text-lg text-muted ml-0.5 font-bold">км</span>
            </h3>
          </div>
          <div className="p-6 flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-1.5 text-muted mb-1">
              <Calendar size={12} />
              <p className="text-[10px] font-bold uppercase tracking-widest">Забегов</p>
            </div>
            <h3 className="text-4xl font-black tracking-tighter text-foreground">{runsCount}</h3>
          </div>
        </div>

        {/* Past Runs History */}
        <div>
          <h2 className="text-xl font-bold mb-4 px-1">История пробежек</h2>
          
          {runsCount > 0 ? (
            <div className="flex flex-col gap-3">
              {runs.map((run: any) => (
                <div 
                  key={run.id} 
                  onClick={() => setSelectedRun(run)}
                  className="bg-card p-4 rounded-2xl border border-border flex items-center justify-between cursor-pointer hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      <Footprints size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg leading-tight">{run.distance.toFixed(2)} км</h4>
                      <p className="text-xs text-muted font-medium">{formatDate(run.startTime)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="font-bold font-mono">{formatDuration(run.durationSec)}</p>
                      <p className="text-xs text-muted font-medium">{formatPace(run.avgPace)} /км</p>
                    </div>
                    <ChevronRight size={16} className="text-muted opacity-50" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-8 bg-card border border-border rounded-2xl text-muted text-sm flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-muted/10 flex items-center justify-center">
                <Footprints size={20} className="opacity-50" />
              </div>
              <p>У вас пока нет сохраненных пробежек.</p>
            </div>
          )}
        </div>
      </div>

      {/* Run Details Modal */}
      {selectedRun && (
        <div className="fixed inset-0 z-[100] flex justify-center items-end sm:items-center bg-background/80 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-lg bg-card sm:rounded-3xl rounded-t-3xl shadow-2xl border border-border flex flex-col max-h-[90dvh] overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-background/50">
              <div>
                <h3 className="font-bold text-lg">Детали пробежки</h3>
                <p className="text-xs text-muted">{formatDate(selectedRun.startTime)}</p>
              </div>
              <button 
                onClick={() => setSelectedRun(null)} 
                className="p-2 hover:bg-border rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="overflow-y-auto p-6 flex flex-col gap-6">
              {/* Main Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-background rounded-2xl p-4 flex flex-col items-center justify-center text-center border border-border">
                  <span className="text-[10px] text-muted font-bold uppercase tracking-widest mb-1">Дистанция</span>
                  <span className="text-xl font-black">{selectedRun.distance.toFixed(2)}<span className="text-xs font-bold text-muted ml-0.5">км</span></span>
                </div>
                <div className="bg-background rounded-2xl p-4 flex flex-col items-center justify-center text-center border border-border">
                  <span className="text-[10px] text-muted font-bold uppercase tracking-widest mb-1">Время</span>
                  <span className="text-xl font-black font-mono">{formatDuration(selectedRun.durationSec)}</span>
                </div>
                <div className="bg-background rounded-2xl p-4 flex flex-col items-center justify-center text-center border border-border">
                  <span className="text-[10px] text-muted font-bold uppercase tracking-widest mb-1">Темп</span>
                  <span className="text-xl font-black font-mono">{formatPace(selectedRun.avgPace)}</span>
                </div>
              </div>

              {/* Map */}
              {selectedRun.routeData ? (
                <div className="rounded-2xl h-48 overflow-hidden border border-border">
                  <RunRouteMap routeData={selectedRun.routeData} />
                </div>
              ) : (
                <div className="bg-background border border-border rounded-2xl h-48 overflow-hidden relative flex items-center justify-center">
                  <MapPin size={32} className="text-muted/30 absolute" />
                  <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
                  <div className="relative z-10 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border text-xs font-bold text-muted">
                    GPS данные отсутствуют
                  </div>
                </div>
              )}

              {/* Splits List */}
              <div>
                <h4 className="font-bold mb-3 flex items-center gap-2">
                  <Footprints size={16} className="text-primary" />
                  Сплиты по километрам
                </h4>
                
                <div className="bg-background border border-border rounded-2xl overflow-hidden divide-y divide-border">
                  {(() => {
                    let splitsArray = [];
                    try {
                      if (selectedRun.splits) splitsArray = JSON.parse(selectedRun.splits);
                    } catch (e) {}

                    if (splitsArray.length > 0) {
                      return splitsArray.map((splitPace: number, index: number) => {
                        const isLastPartial = index === splitsArray.length - 1 && selectedRun.distance % 1 !== 0 && selectedRun.distance > splitsArray.length - 1;
                        const label = isLastPartial 
                          ? `${index} - ${(selectedRun.distance).toFixed(2)} км`
                          : `${index} - ${index + 1} км`;
                        
                        return (
                          <div key={index} className="flex justify-between items-center p-3 px-4">
                            <span className="text-sm font-medium text-muted">{label}</span>
                            <span className="font-mono font-bold text-foreground">{formatPace(splitPace)}</span>
                          </div>
                        );
                      });
                    } else {
                      // Fallback if no splits data
                      const fullKms = Math.floor(selectedRun.distance);
                      const arr = Array.from({length: fullKms || 1});
                      return arr.map((_, index) => (
                        <div key={index} className="flex justify-between items-center p-3 px-4">
                          <span className="text-sm font-medium text-muted">Километр {index + 1}</span>
                          <span className="font-mono font-bold text-foreground">{formatPace(selectedRun.avgPace)}</span>
                        </div>
                      ));
                    }
                  })()}
                </div>
              </div>
            </div>
            
            {/* Safe Area Padding for mobile */}
            <div className="pb-safe"></div>
          </div>
        </div>
      )}
    </div>
  );
}
