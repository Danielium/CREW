"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, ArrowLeft, Square, Play, Pause, Share2, ArrowRight, Loader2, QrCode, X } from "lucide-react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";

const LiveRunMap = dynamic(() => import("@/components/LiveRunMap"), { ssr: false });
const RunRouteMap = dynamic(() => import("@/components/RunRouteMap"), { ssr: false });

// Haversine formula: distance in meters between two GPS coordinates
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function RunTab() {
  const { data: session } = useSession();
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [timeMs, setTimeMs] = useState(0);
  const [distance, setDistance] = useState(0); // in km

  const [autoPause, setAutoPause] = useState(false);
  const [audioComments, setAudioComments] = useState(true);
  const [screenLock, setScreenLock] = useState(false);

  // "settings" | "main" | "splits"
  const [activeScreen, setActiveScreen] = useState<"settings" | "main" | "splits">("main");
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const [activeEvent, setActiveEvent] = useState<{ id: string; title: string } | null>(null);

  const [gpsError, setGpsError] = useState<string | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [currentPosState, setCurrentPosState] = useState<{ lat: number; lng: number } | null>(null);

  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    distance: number;
    timeMs: number;
    avgPace: number;
    routeData: string;
  } | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // GPS tracking refs (use refs to avoid stale closures in watchPosition callback)
  const routeRef = useRef<{ lat: number; lng: number; time: number }[]>([]);
  const distanceRef = useRef(0);
  const watchIdRef = useRef<number | null>(null);
  const lastPositionRef = useRef<{ lat: number; lng: number, time: number } | null>(null);
  const isStoppingRef = useRef(false);
  const isRunningRef = useRef(false);
  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const [isHoldingStop, setIsHoldingStop] = useState(false);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Splits tracking
  const splitsRef = useRef<number[]>([]); // array of seconds-per-km for each completed km
  const splitStartTimeRef = useRef(0); // timestamp (ms) when current km started
  const splitStartDistRef = useRef(0); // distance (km) when current km started
  const lastKmRef = useRef(0); // last completed km

  // Live splits for display
  const [liveSplits, setLiveSplits] = useState<number[]>([]);
  
  // Instantaneous Pace
  const [currentPace, setCurrentPace] = useState(0);
  const paceBufferRef = useRef<number[]>([]);

  useEffect(() => {
    const eventId = localStorage.getItem("activeEventId");
    const eventTitle = localStorage.getItem("activeEventTitle");
    if (eventId && eventTitle) {
      setActiveEvent({ id: eventId, title: eventTitle });
    }
  }, []);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);


  const clearActiveEvent = () => {
    localStorage.removeItem("activeEventId");
    localStorage.removeItem("activeEventTitle");
    setActiveEvent(null);
  };

  // Format time MM:SS or HH:MM:SS
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  // Timer (counts real elapsed time)
  useEffect(() => {
    if (isRunning && !isPaused) {
      timerRef.current = setInterval(() => {
        setTimeMs((prev) => prev + 1000);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, isPaused]);

  // GPS watchPosition
  const startGpsTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError("GPS не поддерживается вашим браузером");
      return;
    }

    setGpsError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, speed } = position.coords;
        const now = Date.now();

        // Always update the current position state so the user sees their marker and map centers
        setCurrentPosState({ lat: latitude, lng: longitude });

        if (isRunningRef.current) {
          const last = lastPositionRef.current;
          if (last) {
            const d = haversineDistance(last.lat, last.lng, latitude, longitude);
            // Ignore tiny movements (< 2m) to reduce GPS noise
            if (d < 2) return;
            // Ignore unrealistic jumps (> 150m in one tick — probably GPS glitch)
            if (d > 150) return;

            distanceRef.current += d / 1000; // convert meters to km
            setDistance(distanceRef.current);

            // Check for new km split
            const currentKm = Math.floor(distanceRef.current);
            if (currentKm > lastKmRef.current) {
              const splitTime = (now - splitStartTimeRef.current) / 1000; // seconds for this km
              const splitDist = distanceRef.current - splitStartDistRef.current;
              const paceMinPerKm = splitDist > 0 ? splitTime / 60 / splitDist : 0;
              splitsRef.current.push(paceMinPerKm);
              setLiveSplits([...splitsRef.current]);

              lastKmRef.current = currentKm;
              splitStartTimeRef.current = now;
              splitStartDistRef.current = distanceRef.current;
            }

            // Smoothed instantaneous pace calculation
            let currentSpeed = speed; // m/s from GPS hardware
            if (currentSpeed === null) {
              // Fallback if hardware speed is unavailable
              const dist = haversineDistance(last.lat, last.lng, latitude, longitude);
              const timeDiff = (now - last.time) / 1000;
              currentSpeed = timeDiff > 0 ? dist / timeDiff : 0;
            }

            // Add to rolling buffer (last 5 readings ~ 5 seconds)
            paceBufferRef.current.push(currentSpeed);
            if (paceBufferRef.current.length > 5) {
              paceBufferRef.current.shift();
            }

            // Calculate smoothed speed
            const avgSpeed = paceBufferRef.current.reduce((a, b) => a + b, 0) / paceBufferRef.current.length;

            // Convert m/s to min/km
            // If moving slower than 0.5 m/s (1.8 km/h), consider it standing still
            if (avgSpeed > 0.5) {
              setCurrentPace(16.666667 / avgSpeed);
            } else {
              setCurrentPace(0);
            }

          } else {
            // First position — initialize split tracking
            splitStartTimeRef.current = now;
            splitStartDistRef.current = 0;
            paceBufferRef.current = [];
          }
          routeRef.current.push({ lat: latitude, lng: longitude, time: now });
        }

        lastPositionRef.current = { lat: latitude, lng: longitude, time: now };
      },
      (error) => {
        console.error("GPS error details:", error.code, error.message);
        if (error.code === error.PERMISSION_DENIED) {
          setGpsError("Доступ к GPS запрещён. Разрешите геолокацию в настройках браузера.");
        } else {
          setGpsError(`Не удалось получить GPS-сигнал (Код ${error.code}: ${error.message || "Неизвестная ошибка"})`);
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );
  }, []);

  const stopGpsTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (isStoppingRef.current) {
        isStoppingRef.current = false;
        return;
      }
      if (isRunning) {
        window.history.pushState({ running: true }, "");
        const confirmAbort = window.confirm("Вы хотите прервать пробежку? Прогресс не сохранится.");
        if (confirmAbort) {
          stopGpsTracking();
          setIsRunning(false);
          setTimeout(() => {
            window.history.go(-2);
          }, 100);
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isRunning, stopGpsTracking]);

  useEffect(() => {
    if (showMapModal) {
      if (!isRunning) {
        startGpsTracking();
      }
    } else {
      if (!isRunning) {
        stopGpsTracking();
      }
    }
  }, [showMapModal, isRunning, startGpsTracking, stopGpsTracking]);

  const startSimulation = () => {
    setIsSimulating(true);
    setGpsError(null);
    setIsRunning(true);
    setIsPaused(false);

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (!window.history.state?.running) {
      window.history.pushState({ running: true }, "");
    }

    let lat = 55.7558;
    let lng = 37.6173;
    const now = Date.now();
    lastPositionRef.current = { lat, lng, time: now };
    routeRef.current.push({ lat, lng, time: now });
    setCurrentPosState({ lat, lng });

    if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);

    simulationIntervalRef.current = setInterval(() => {
      // 5:00 pace is 12 km/h, which is 3.33 meters/second
      const dMeters = 3.33 + (Math.random() - 0.5) * 0.5;
      const dKm = dMeters / 1000;

      distanceRef.current += dKm;
      setDistance(distanceRef.current);

      const angle = (Date.now() / 8000) % (2 * Math.PI);
      lat += (Math.cos(angle) * dMeters) / 111000;
      lng += (Math.sin(angle) * dMeters) / (111000 * Math.cos((lat * Math.PI) / 180));

      const currentNow = Date.now();

      const currentKm = Math.floor(distanceRef.current);
      if (currentKm > lastKmRef.current) {
        const splitTime = (currentNow - splitStartTimeRef.current) / 1000;
        const splitDist = distanceRef.current - splitStartDistRef.current;
        const paceMinPerKm = splitDist > 0 ? splitTime / 60 / splitDist : 0;
        splitsRef.current.push(paceMinPerKm);
        setLiveSplits([...splitsRef.current]);

        lastKmRef.current = currentKm;
        splitStartTimeRef.current = currentNow;
        splitStartDistRef.current = distanceRef.current;
      }

      lastPositionRef.current = { lat, lng, time: currentNow };
      routeRef.current.push({ lat, lng, time: currentNow });
      setCurrentPosState({ lat, lng });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
      if (holdTimeoutRef.current) {
        clearTimeout(holdTimeoutRef.current);
      }
    };
  }, []);

  // Hide nav when running
  useEffect(() => {
    if (isRunning) {
      window.dispatchEvent(new Event("hideNav"));
    } else {
      window.dispatchEvent(new Event("showNav"));
      setActiveScreen("main");
    }

    return () => {
      window.dispatchEvent(new Event("showNav"));
    };
  }, [isRunning]);

  const handleStart = () => {
    if (!session?.user) {
      alert("Пожалуйста, войдите в аккаунт на вкладке Профиль, чтобы сохранять тренировки!");
      return;
    }
    // Reset everything
    routeRef.current = [];
    distanceRef.current = 0;
    lastPositionRef.current = null;
    splitsRef.current = [];
    splitStartTimeRef.current = Date.now();
    splitStartDistRef.current = 0;
    lastKmRef.current = 0;
    setLiveSplits([]);
    setDistance(0);
    setTimeMs(0);
    setGpsError(null);
    setIsSimulating(false);

    setIsRunning(true);
    setIsPaused(false);
    startGpsTracking();
    window.history.pushState({ running: true }, "");
  };

  const handlePause = () => {
    setIsPaused(true);
    stopGpsTracking();
  };

  const handleResume = () => {
    setIsPaused(false);
    // Reset lastPosition so we don't count the distance during pause
    lastPositionRef.current = null;
    if (isSimulating) {
      startSimulation();
    } else {
      startGpsTracking();
    }
  };

  const startHold = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== undefined) return;
    if (isSaving) return;
    
    setIsHoldingStop(true);
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    
    holdTimeoutRef.current = setTimeout(() => {
      handleStop();
      setIsHoldingStop(false);
    }, 3000);
  };

  const cancelHold = () => {
    setIsHoldingStop(false);
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
  };

  const handleCloseSummary = () => {
    setShowSummaryModal(false);
    setSummaryData(null);
    setTimeMs(0);
    setDistance(0);
    setLiveSplits([]);
    setActiveScreen("main");
  };

  const handleStop = async () => {
    if (isSaving) return;
    isStoppingRef.current = true;
    setIsRunning(false);
    setIsPaused(false);
    setShowMapModal(false); // Hide the map overlay when stopped
    stopGpsTracking();
    setIsSimulating(false);

    if (window.history.state?.running) {
      window.history.back();
    }

    const finalDistance = distanceRef.current;
    const finalTimeMs = timeMs;
    const finalRoute = routeRef.current;
    const finalSplits = splitsRef.current;

    const pace = finalDistance > 0 ? (finalTimeMs / 1000 / 60) / finalDistance : 0;

    // Show summary modal (TEMPORARILY UNCONDITIONAL FOR TESTING)
    if (true) {
      setSummaryData({
        distance: finalDistance,
        timeMs: finalTimeMs,
        avgPace: isFinite(pace) ? pace : 0,
        routeData: JSON.stringify(finalRoute.map((p) => ({ lat: p.lat, lng: p.lng }))),
      });
      setShowSummaryModal(true);
    } else {
      setTimeMs(0);
      setDistance(0);
      setLiveSplits([]);
      setActiveScreen("main");
    }

    if (session?.user) { // TEMPORARILY UNCONDITIONAL FOR TESTING
      setIsSaving(true);
      try {
        // Build splits JSON — add final partial km if needed
        const allSplits = [...finalSplits];
        const partialKmDist = finalDistance - Math.floor(finalDistance);
        if (partialKmDist > 0.01) {
          const partialTime = (Date.now() - splitStartTimeRef.current) / 1000;
          const partialPace = partialTime / 60 / partialKmDist;
          allSplits.push(partialPace);
        }

        // Build routeData
        const routeData = finalRoute.map((p) => ({ lat: p.lat, lng: p.lng }));

        await fetch("/api/runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: (session.user as any).id,
            distance: parseFloat(finalDistance.toFixed(2)),
            durationSec: Math.floor(finalTimeMs / 1000),
            avgPace: isFinite(pace) ? pace : 0,
            eventId: activeEvent?.id || null,
            splits: JSON.stringify(allSplits),
            routeData: routeData,
          }),
        });

        if (activeEvent) {
          localStorage.removeItem("activeEventId");
          localStorage.removeItem("activeEventTitle");
          setActiveEvent(null);
        }
      } catch (error) {
        console.error("Failed to save run", error);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isRunning) return;
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isRunning || touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const swipeDist = touchStart - touchEnd;
    const minSwipeDistance = 50;

    if (swipeDist > minSwipeDistance) {
      if (activeScreen === "settings") setActiveScreen("main");
      else if (activeScreen === "main") setActiveScreen("splits");
    } else if (swipeDist < -minSwipeDistance) {
      if (activeScreen === "splits") setActiveScreen("main");
      else if (activeScreen === "main") setActiveScreen("settings");
    }
    setTouchStart(null);
  };

  // Format pace string

  const formatPace = (pace: number) => {
    if (pace === 0 || !isFinite(pace) || pace > 30) return "0:00";
    const minutes = Math.floor(pace);
    const seconds = Math.floor((pace - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className="flex flex-col absolute inset-0 bg-background text-foreground z-50 overflow-hidden"
    >
      {/* GPS Error Banner */}
      {gpsError && (
        <div className="absolute top-0 left-0 right-0 z-[60] bg-red-500/90 text-white text-center text-xs font-bold py-2.5 px-4 backdrop-blur-sm flex items-center justify-between gap-4">
          <span className="text-left flex-1">{gpsError}</span>
          {!isSimulating && (
            <button 
              onClick={startSimulation}
              className="bg-white text-black px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all cursor-pointer flex-shrink-0"
            >
              Симулировать бег
            </button>
          )}
        </div>
      )}


      <div className="w-full h-full flex flex-col relative z-10">
          <div className="pt-8 px-6 z-10 flex justify-center">
            {activeEvent && !isRunning && (
              <div className="bg-primary text-black pl-4 pr-1 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(204,255,0,0.4)] animate-in fade-in slide-in-from-top-4 flex items-center gap-2">
                <span>🎯 Забег: {activeEvent.title}</span>
                <button 
                  onClick={clearActiveEvent}
                  className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black/10 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Giant Metrics */}
          <div className="flex-1 flex flex-col justify-center px-4 transition-all duration-500 z-10">
            {/* TIME */}
            <div className="flex flex-col items-center mb-6">
              <span className="text-xs font-black text-muted uppercase tracking-[0.3em] mb-1">Время</span>
              <h1 className="text-[5rem] leading-none font-black tracking-tighter tabular-nums drop-shadow-sm">
                {formatTime(timeMs)}
              </h1>
            </div>

            <div className="w-full h-[1px] bg-border max-w-xs mx-auto mb-6"></div>

            {/* SPEED / PACE */}
            <div className="flex flex-col items-center mb-6">
              <span className="text-xs font-black text-muted uppercase tracking-[0.3em] mb-1">Темп</span>
              <h2 className="text-[4rem] leading-none font-black tracking-tighter tabular-nums drop-shadow-sm">
                {formatPace(currentPace)}
              </h2>
              <span className="text-[10px] font-bold text-muted uppercase tracking-widest mt-1">Мин/Км</span>
            </div>

            <div className="w-full h-[1px] bg-border max-w-xs mx-auto mb-6"></div>

            {/* DISTANCE */}
            <div className="flex flex-col items-center">
              <span className="text-xs font-black text-muted uppercase tracking-[0.3em] mb-1">Дистанция</span>
              <h2 className="text-[4rem] leading-none font-black tracking-tighter tabular-nums drop-shadow-sm">
                {distance.toFixed(2)}
              </h2>
              <span className="text-[10px] font-bold text-muted uppercase tracking-widest mt-1">Километры</span>
            </div>
          </div>

          {/* Controls */}
          <div className="pb-8 px-8 flex items-center justify-between z-20 mt-auto">
            {/* Left Action (Back/Stop) */}
            {!isRunning ? (
              <button
                onClick={() => window.history.back()}
                className="w-14 h-14 rounded-full bg-card border border-border flex items-center justify-center text-foreground hover:bg-border transition-colors"
              >
                <ArrowLeft size={24} />
              </button>
            ) : (
              <button
                onPointerDown={startHold}
                onPointerUp={cancelHold}
                onPointerLeave={cancelHold}
                onPointerCancel={cancelHold}
                disabled={isSaving}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                  isHoldingStop
                    ? "scale-90 bg-red-500/10 text-red-500 border-transparent shadow-none"
                    : isPaused
                      ? "bg-red-500 text-white shadow-lg shadow-red-500/20 border-transparent"
                      : "bg-card border border-border text-foreground hover:bg-border"
                } disabled:opacity-50 select-none touch-none relative`}
              >
                {isSaving ? (
                  <Loader2 className="animate-spin text-muted" size={24} />
                ) : (
                  <>
                    <Square size={24} fill="currentColor" className="relative z-10" />
                    <svg className="absolute inset-0 w-full h-full pointer-events-none select-none">
                      <circle
                        cx="32"
                        cy="32"
                        r="29"
                        stroke={isPaused ? "#FFFFFF" : "#EF4444"}
                        strokeWidth="3.5"
                        fill="transparent"
                        strokeDasharray={182.2}
                        strokeDashoffset={isHoldingStop ? 0 : 182.2}
                        className={`transform origin-center -rotate-90 transition-all ${
                          isHoldingStop ? "duration-[3000ms] ease-linear" : "duration-200 ease-out"
                        }`}
                        strokeLinecap="round"
                      />
                    </svg>
                  </>
                )}
              </button>
            )}

            {/* Center Action (Start/Pause/Resume) */}
            <div className="flex flex-col items-center">
              {!isRunning && (
                <div className="flex items-center gap-4 mb-4">
                  {/* Global QR scanner button removed as check-in is now handled directly via events in the feed */}
                </div>
              )}

              {!isRunning ? (
                <button
                  onClick={handleStart}
                  className="w-24 h-24 rounded-full bg-primary text-black flex items-center justify-center shadow-[0_0_40px_rgba(204,255,0,0.4)] active:scale-95 transition-all border-4 border-background"
                >
                  <span className="font-black text-xl uppercase tracking-wider">Старт</span>
                </button>
              ) : (
                <button
                  onClick={isPaused ? handleResume : handlePause}
                  className={`w-28 h-28 rounded-full flex items-center justify-center active:scale-95 transition-all border-4 border-background ${
                    isPaused ? "bg-primary text-black shadow-[0_0_40px_rgba(204,255,0,0.4)]" : "bg-orange-500 text-white shadow-[0_0_40px_rgba(249,115,22,0.4)]"
                  }`}
                >
                  {isPaused ? <Play size={40} fill="currentColor" className="ml-1.5" /> : <Pause size={40} fill="currentColor" />}
                </button>
              )}
            </div>

            {/* Right Action (Map Toggle / Open Map) */}
            {/* Right Action (Map Toggle / Open Map) */}
            <button
              onClick={() => {
                setShowMapModal(true);
              }}
              className="w-14 h-14 rounded-full bg-card border border-border flex items-center justify-center text-foreground hover:bg-border transition-colors active:scale-95 cursor-pointer"
            >
              <MapPin size={24} />
            </button>
          </div>
        </div>


      {/* Map Overlay Modal */}
      {showMapModal && (
        <div className="fixed inset-0 z-[80] flex justify-center bg-background pointer-events-auto">
          <div className="w-full max-w-[480px] h-full relative flex flex-col">
            
            {/* Back Button */}
            <button 
              onClick={() => setShowMapModal(false)}
              className="absolute top-12 left-6 z-[2000] w-12 h-12 bg-card border border-border rounded-full flex items-center justify-center text-foreground hover:bg-border active:scale-95 transition-all shadow-lg cursor-pointer"
            >
              <ArrowLeft size={20} />
            </button>

            {/* Title / Info */}
            <div className="absolute top-12 right-6 z-[2000] bg-card/85 backdrop-blur-md border border-border rounded-2xl px-4 py-2 shadow-lg flex flex-col items-end">
              <span className="text-[10px] font-black text-muted uppercase tracking-wider">Время</span>
              <span className="font-mono font-bold text-sm">{formatTime(timeMs)}</span>
              <span className="text-[10px] font-black text-muted uppercase tracking-wider mt-1">Дистанция</span>
              <span className="font-mono font-bold text-sm">{distance.toFixed(2)} км</span>
            </div>

            {/* Map */}
            <div className="flex-1 w-full relative min-h-0">
              <LiveRunMap 
                route={[...routeRef.current]} 
                currentPosition={currentPosState} 
              />
            </div>
            
          </div>
        </div>
      )}

      {/* Summary Modal overlay */}
      {showSummaryModal && summaryData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
          {/* Confetti container */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
            {Array.from({ length: 40 }).map((_, idx) => {
              const left = Math.random() * 100;
              const delay = Math.random() * 3;
              const size = 5 + Math.random() * 10;
              const duration = 2 + Math.random() * 3;
              const colors = ["#CCFF00", "#FF4444", "#38BDF8", "#F59E0B", "#EC4899"];
              const randomColor = colors[Math.floor(Math.random() * colors.length)];
              return (
                <div
                  key={idx}
                  className="absolute animate-fall rounded-full opacity-80"
                  style={{
                    left: `${left}%`,
                    top: `-10%`,
                    width: `${size}px`,
                    height: `${size}px`,
                    backgroundColor: randomColor,
                    animationDelay: `${delay}s`,
                    animationDuration: `${duration}s`,
                    animationIterationCount: "infinite",
                  }}
                />
              );
            })}
          </div>

          <style>{`
            @keyframes fall {
              0% {
                transform: translateY(0) rotate(0deg);
                opacity: 0.8;
              }
              100% {
                transform: translateY(100vh) rotate(360deg);
                opacity: 0;
              }
            }
            .animate-fall {
              animation-name: fall;
              animation-timing-function: linear;
              animation-iteration-count: infinite;
            }
          `}</style>

          <div className="bg-card border border-border w-full max-w-sm rounded-[32px] p-6 flex flex-col shadow-2xl relative z-20 animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black text-center text-primary mb-1 uppercase tracking-wider">
              Забег завершён!
            </h3>
            <p className="text-xs text-muted text-center mb-6 uppercase tracking-widest font-semibold">
              Отличная работа, атлет! ⚡️
            </p>

            {/* Metrics grid */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              <div className="bg-background border border-border/50 rounded-2xl p-3 flex flex-col items-center justify-center">
                <span className="text-[10px] font-black text-muted uppercase tracking-wider mb-1">Дистанция</span>
                <span className="text-xl font-bold font-mono text-foreground leading-none">
                  {summaryData.distance.toFixed(2)}
                </span>
                <span className="text-[9px] font-medium text-muted mt-1">км</span>
              </div>
              <div className="bg-background border border-border/50 rounded-2xl p-3 flex flex-col items-center justify-center">
                <span className="text-[10px] font-black text-muted uppercase tracking-wider mb-1">Время</span>
                <span className="text-lg font-bold font-mono text-foreground leading-none">
                  {formatTime(summaryData.timeMs)}
                </span>
                <span className="text-[9px] font-medium text-muted mt-1">минут</span>
              </div>
              <div className="bg-background border border-border/50 rounded-2xl p-3 flex flex-col items-center justify-center">
                <span className="text-[10px] font-black text-muted uppercase tracking-wider mb-1">Темп</span>
                <span className="text-xl font-bold font-mono text-foreground leading-none">
                  {formatPace(summaryData.avgPace)}
                </span>
                <span className="text-[9px] font-medium text-muted mt-1">мин/км</span>
              </div>
            </div>

            {/* Miniature Map */}
            {summaryData.routeData && JSON.parse(summaryData.routeData).length >= 2 ? (
              <div className="w-full h-44 rounded-2xl overflow-hidden border border-border/60 relative mb-6">
                <RunRouteMap routeData={summaryData.routeData} />
              </div>
            ) : (
              <div className="w-full h-44 bg-background border border-border rounded-2xl flex flex-col items-center justify-center text-muted mb-6 text-xs p-4 text-center">
                Карта маршрута недоступна (недостаточно точек GPS)
              </div>
            )}

            <button
              onClick={handleCloseSummary}
              className="w-full bg-primary text-black py-4 rounded-2xl font-black text-base uppercase tracking-wider active:scale-98 transition-all hover:shadow-[0_0_20px_rgba(204,255,0,0.3)] cursor-pointer"
            >
              Отлично
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
