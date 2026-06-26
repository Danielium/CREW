"use client";
import { useState, useEffect, Suspense } from "react";
import { ArrowLeft, Loader2, MapPin, Clock, Activity } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { triggerHaptic } from "@/lib/haptics";
import dynamic from "next/dynamic";

const MapPicker = dynamic(() => import("@/components/MapPicker"), { ssr: false });



function CreateProposalInner() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState<[number, number]>([55.7558, 37.6173]);
  const [paceFrom, setPaceFrom] = useState("");
  const [paceTo, setPaceTo] = useState("");
  const [isPaceToModified, setIsPaceToModified] = useState(false);
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  const searchParams = useSearchParams();

  useEffect(() => {
    // Hide navigation bar
    window.dispatchEvent(new Event('hideNav'));

    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    
    if (lat && lng) {
      setPosition([parseFloat(lat), parseFloat(lng)]);
    } else {
      const getInitialPosition = async () => {
        try {
          const { Capacitor } = await import('@capacitor/core');
          if (Capacitor.isNativePlatform()) {
            const { Geolocation } = await import('@capacitor/geolocation');
            const perm = await Geolocation.checkPermissions();
            if (perm.location !== 'granted') {
              await Geolocation.requestPermissions();
            }
            const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
            setPosition([pos.coords.latitude, pos.coords.longitude]);
            return;
          }
        } catch (e) {
          console.error("Capacitor geolocation error:", e);
        }

        // Fallbacks
        const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
        if (tg?.LocationManager) {
          tg.LocationManager.init(() => {
            tg.LocationManager.getLocation((data: any) => {
              if (data) setPosition([data.latitude, data.longitude]);
            });
          });
        } else if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => setPosition([pos.coords.latitude, pos.coords.longitude]),
            () => {},
            { enableHighAccuracy: true }
          );
        }
      };

      getInitialPosition();
    }

    return () => {
      // Show navigation bar on unmount
      window.dispatchEvent(new Event('showNav'));
    };
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!time || !date) return;
    
    triggerHaptic('medium');
    setIsLoading(true);

    try {
      const startTime = new Date(`${date}T${time}`);
      let finalPace = paceFrom;
      if (isPaceToModified && paceTo && paceTo !== paceFrom) {
        finalPace = `${paceFrom} - ${paceTo}`;
      }

      const res = await fetch("/api/map-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: position[0],
          lng: position[1],
          pace: finalPace,
          startTime: startTime.toISOString(),
          maxParticipants: 0
        })
      });

      if (res.ok) {
        router.push("/map");
        router.refresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-black text-foreground">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-border z-10 relative bg-black">
        <button onClick={() => router.back()} className="p-2 bg-card rounded-full active:scale-95">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-black uppercase tracking-tight">Новый забег</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1">
        {/* Map Picker */}
        <div className="h-64 relative bg-card">
          {typeof window !== 'undefined' && (
            <MapPicker position={position} setPosition={setPosition} />
          )}
          <div className="absolute top-4 left-4 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full text-xs font-bold pointer-events-none z-[400] text-white">
            Кликните на карту, чтобы поставить точку
          </div>
        </div>

        {/* Details Form */}
        <div className="p-6 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase font-bold tracking-wider pl-4 text-muted flex items-center gap-2">
              <Clock size={16} /> Дата и время старта
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-2xl flex items-center pl-4 pr-2 py-3 focus-within:border-primary transition-colors">
                <input 
                  type="date" 
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                  required 
                  className="bg-transparent border-none outline-none w-full font-medium text-sm cursor-pointer" 
                />
              </div>
              <div className="bg-card border border-border rounded-2xl flex items-center pl-4 pr-2 py-3 focus-within:border-primary transition-colors">
                <input 
                  type="time" 
                  value={time} 
                  onChange={e => setTime(e.target.value)} 
                  required 
                  className="bg-transparent border-none outline-none w-full font-medium text-sm cursor-pointer" 
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase font-bold tracking-wider pl-4 text-muted flex items-center gap-2">
              <Activity size={16} /> Ожидаемый темп (мин/км)
            </label>
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-card border border-border rounded-2xl flex items-center p-3 gap-3 focus-within:border-primary transition-colors">
                 <span className="text-muted text-xs font-bold uppercase">ОТ</span>
                 <input 
                   type="text" 
                   placeholder=":"
                   pattern="^\d{1,2}:[0-5]\d$"
                   title="Введите темп в формате ММ:СС (например, 5:30)"
                   maxLength={5}
                   className="bg-transparent border-none outline-none w-full font-medium"
                   value={paceFrom}
                   onChange={(e) => {
                     setPaceFrom(e.target.value);
                     if (!isPaceToModified) setPaceTo(e.target.value);
                   }}
                 />
               </div>
               <div className="bg-card border border-border rounded-2xl flex items-center p-3 gap-3 focus-within:border-primary transition-colors">
                 <span className="text-muted text-xs font-bold uppercase">ДО</span>
                 <input 
                   type="text" 
                   placeholder=":"
                   pattern="^\d{1,2}:[0-5]\d$"
                   title="Введите темп в формате ММ:СС (например, 5:30)"
                   maxLength={5}
                   className="bg-transparent border-none outline-none w-full font-medium"
                   value={paceTo}
                   onChange={(e) => {
                     setPaceTo(e.target.value);
                     setIsPaceToModified(true);
                   }}
                 />
               </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading || !time || !date}
            className="w-full py-4 mt-4 bg-primary text-black font-black uppercase tracking-wider rounded-2xl flex items-center justify-center hover:bg-[#b3e600] active:scale-95 transition-all disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : "Поставить маячок"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function CreateProposal() {
  return (
    <Suspense fallback={<div className="flex min-h-[100dvh] items-center justify-center bg-black"><Loader2 className="animate-spin text-primary" size={32} /></div>}>
      <CreateProposalInner />
    </Suspense>
  );
}
