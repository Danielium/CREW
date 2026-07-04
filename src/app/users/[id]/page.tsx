"use client";

import { useState, useEffect } from "react";
import { Lock, Sunrise, Loader2, Users } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

export default function PublicProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Stats and Filters
  const now = new Date();
  const [timeRange, setTimeRange] = useState<"W" | "M" | "Y" | "ALL">("M");
  
  const [selectedWeekOffset, setSelectedWeekOffset] = useState<number>(0);
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  
  const [showAllRuns, setShowAllRuns] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`/api/users/${id}`);
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
    if (id) fetchUser();
  }, [id]);

  // --- Filtering & Stats Calculation ---
  const getFilterBounds = () => {
    let start = new Date(0);
    let end = new Date();
    
    if (timeRange === "W") {
      const currentDay = now.getDay() === 0 ? 7 : now.getDay(); 
      const startOfCurrentWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - currentDay + 1);
      start = new Date(startOfCurrentWeek.getTime() - selectedWeekOffset * 7 * 24 * 60 * 60 * 1000);
      end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
    } else if (timeRange === "M") {
      start = new Date(selectedYear, selectedMonth, 1);
      end = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
    } else if (timeRange === "Y") {
      start = new Date(selectedYear, 0, 1);
      end = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
    }
    return { start, end };
  };
  
  const { start: filterStart, end: filterEnd } = getFilterBounds();

  const filteredRuns = userData?.runs?.filter((r: any) => {
    if (r.status !== "COMPLETED") return false;
    const runDate = new Date(r.startTime);
    if (timeRange === "ALL") return true;
    return runDate >= filterStart && runDate <= filterEnd;
  }) || [];

  const filteredDistance = filteredRuns.reduce((acc: number, r: any) => acc + (r.distance || 0), 0);
  const filteredTime = filteredRuns.reduce((acc: number, r: any) => acc + (r.durationSec || 0), 0);
  const filteredPace = filteredDistance > 0 ? (filteredTime / 60) / filteredDistance : 0;
  
  const getDateLabel = () => {
    if (timeRange === "W") {
      if (selectedWeekOffset === 0) return "Эта неделя";
      if (selectedWeekOffset === 1) return "Прошлая неделя";
      const startStr = filterStart.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
      const endStr = filterEnd.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
      return `${startStr} - ${endStr}`;
    }
    if (timeRange === "M") {
      const d = new Date(selectedYear, selectedMonth, 1);
      return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).toLowerCase();
    }
    if (timeRange === "Y") return `${selectedYear} г.`;
    return "За всё время";
  };

  const formatPace = (pace: number) => {
    if (!pace || pace === 0) return "--";
    const mins = Math.floor(pace);
    const secs = Math.round((pace % 1) * 60);
    return `${mins}'${secs.toString().padStart(2, '0')}"`;
  };

  const formatTime = (secs: number) => {
    if (!secs) return "0:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.round(secs % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const generateChartData = () => {
    let buckets: { label: string, value: number }[] = [];
    if (timeRange === "W") {
      for (let i = 0; i < 7; i++) {
        const d = new Date(filterStart.getTime() + i * 24 * 60 * 60 * 1000);
        buckets.push({ label: d.getDate().toString(), value: 0 });
      }
      filteredRuns.forEach((r: any) => {
        const d = new Date(r.startTime);
        const diffDays = Math.floor((d.getTime() - filterStart.getTime()) / (1000 * 3600 * 24));
        if (diffDays >= 0 && diffDays < 7) {
          buckets[diffDays].value += r.distance || 0;
        }
      });
    } else if (timeRange === "M") {
      const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      for (let i = 0; i < daysInMonth; i++) {
        const d = new Date(selectedYear, selectedMonth, i + 1);
        const isLabel = i === 0 || i === 9 || i === 19 || i === daysInMonth - 1;
        buckets.push({ label: isLabel ? d.getDate().toString() : "", value: 0 });
      }
      filteredRuns.forEach((r: any) => {
        const d = new Date(r.startTime);
        const dayIdx = d.getDate() - 1;
        if (dayIdx >= 0 && dayIdx < daysInMonth) {
          buckets[dayIdx].value += r.distance || 0;
        }
      });
    } else if (timeRange === "Y" || timeRange === "ALL") {
      const yearToUse = timeRange === "Y" ? selectedYear : now.getFullYear();
      for (let i = 0; i < 12; i++) {
        const d = new Date(yearToUse, i, 1);
        const monthLabel = d.toLocaleString('ru-RU', { month: 'short' }).replace('.', '');
        buckets.push({ label: monthLabel, value: 0 });
      }
      filteredRuns.forEach((r: any) => {
        const d = new Date(r.startTime);
        if (timeRange === "ALL" || d.getFullYear() === yearToUse) {
          buckets[d.getMonth()].value += r.distance || 0;
        }
      });
    }
    const maxVal = Math.max(...buckets.map(b => b.value), 1); 
    return { buckets, maxVal };
  };

  const { buckets: chartBuckets, maxVal: chartMax } = generateChartData();
  // --- End Filtering ---

  const renderAvatar = (avatarStr: string | null | undefined, sizeClass: string = "text-5xl") => {
    if (!avatarStr) return <Users size={40} className="text-muted" />;
    const isImage = avatarStr.startsWith('http') || avatarStr.startsWith('data:') || avatarStr.startsWith('blob:') || avatarStr.startsWith('/uploads');
    if (isImage) {
      return <img src={avatarStr} alt="Avatar" className="w-full h-full object-cover" />;
    }
    return <div className={`flex items-center justify-center w-full h-full ${sizeClass}`}>{avatarStr}</div>;
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={40} /></div>;
  }

  if (!userData) {
    return (
      <div className="flex flex-col min-h-[100dvh] items-center justify-center bg-background text-foreground">
        <p>Пользователь не найден</p>
        <button onClick={() => router.back()} className="mt-4 text-primary underline">Назад</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] text-foreground pt-safe pb-24 relative z-10 animate-in fade-in duration-500">
      <div className="flex justify-between items-center px-4 pb-4 sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <h1 className="text-xl font-black uppercase tracking-widest">Профиль</h1>
        {/* Native back button used here via TelegramBackButton */}
      </div>

      {/* Header & Avatar */}
      <div className="px-4 mb-6 relative">
        <div className="flex flex-col items-center mt-8">
          <div className="relative">
            {/* Avatar Frame */}
            <div className="absolute -inset-2 bg-gradient-to-tr from-[#CCFF00] to-transparent rounded-full opacity-30"></div>
            <div className="w-28 h-28 rounded-full border-4 border-[#000] relative z-10 overflow-hidden bg-card flex items-center justify-center">
              {renderAvatar(userData?.image)}
            </div>
          </div>
          
          <h1 className="text-3xl font-black mt-4 uppercase text-center">{userData?.name || "Гость"}</h1>
        </div>
      </div>

      {userData.isPrivate ? (
        <div className="flex flex-col items-center justify-center p-12 text-center text-muted mt-8">
          <div className="w-16 h-16 bg-card rounded-full flex items-center justify-center mb-4 border border-border shadow-lg">
            <Lock size={24} className="text-foreground/50" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">Профиль закрыт</h3>
          <p className="text-sm max-w-[250px]">Этот пользователь ограничил просмотр своей статистики настройками приватности.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 px-4">
          
          {/* Segmented Control */}
          <div className="bg-card border border-border rounded-full p-1 mt-2 mx-auto w-full max-w-[320px] relative">
            <div className="flex relative w-full h-full">
              {/* Animated Pill */}
              <div 
                className="absolute top-0 bottom-0 w-1/4 bg-primary rounded-full transition-transform duration-300 ease-out z-0 shadow-sm"
                style={{
                  transform: `translateX(${
                    timeRange === "W" ? "0%" :
                    timeRange === "M" ? "100%" :
                    timeRange === "Y" ? "200%" :
                    "300%"
                  })`
                }}
              />
              {[
                { id: "W", label: "Н" },
                { id: "M", label: "М" },
                { id: "Y", label: "Г" },
                { id: "ALL", label: "Все" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setTimeRange(tab.id as any);
                    if (typeof window !== 'undefined') {
                      (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
                    }
                  }}
                  className={`flex-1 py-2 text-sm font-bold rounded-full transition-colors relative z-10 ${
                    timeRange === tab.id 
                      ? "text-black" 
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Stats Summary */}
          <div className="flex flex-col mb-4">
            <div className="flex items-center gap-1 mb-1 w-fit py-3">
              <span className="text-sm font-medium">{getDateLabel()}</span>
            </div>
            
            <h2 className="text-[80px] leading-[0.8] font-black italic tracking-tighter -ml-1">
              {filteredDistance.toFixed(2).replace('.', ',')}
            </h2>
            <p className="text-xs text-muted font-bold tracking-widest uppercase mt-3 mb-6">Километров</p>
            
            <div className="grid grid-cols-3 gap-2 w-full">
              <div className="flex flex-col">
                <span className="text-2xl font-black">{filteredRuns.length}</span>
                <span className="text-[10px] text-muted uppercase font-bold tracking-wider mt-1">Пробежек</span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-black">{formatPace(filteredPace)}</span>
                <span className="text-[10px] text-muted uppercase font-bold tracking-wider mt-1">Средн. темп</span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-black">{formatTime(filteredTime)}</span>
                <span className="text-[10px] text-muted uppercase font-bold tracking-wider mt-1">Время</span>
              </div>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="relative h-40 w-full mt-4 flex items-end justify-between gap-1 pt-4 pb-6">
            {/* Y Axis Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between pb-6 pointer-events-none z-0">
              <div className="w-full h-[1px] bg-border/40"></div>
              <div className="w-full h-[1px] bg-border/40"></div>
              <div className="w-full h-[1px] bg-border/40"></div>
              <div className="w-full h-[1px] bg-border/40 flex items-center justify-end"><span className="text-[10px] text-muted translate-x-4">0 км</span></div>
            </div>
            
            {/* Y Axis Max Label */}
            <div className="absolute top-0 right-0 -translate-y-2 text-[10px] text-muted z-0">
              {Math.ceil(chartMax)}
            </div>

            {/* Bars & X Axis */}
            {chartBuckets.map((bucket, i) => {
              const h = (bucket.value / chartMax) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col justify-end items-center h-full relative z-10 group">
                  {bucket.value > 0 && (
                    <div 
                      className="w-[80%] max-w-[8px] bg-primary rounded-t-sm transition-all duration-500 ease-out" 
                      style={{ height: `${h}%` }}
                    />
                  )}
                  {/* X Axis Label */}
                  {bucket.label && (
                    <div className="absolute -bottom-6 text-[10px] text-muted truncate text-center w-[200%]">
                      {bucket.label}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Recent Runs List */}
          <div className="mb-24 mt-8">
            <h3 className="font-bold text-lg mb-6 text-foreground">Последние действия</h3>
            <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto pb-4" style={{ scrollbarWidth: 'none' }}>
              {filteredRuns.length > 0 ? (
                <>
                  {(showAllRuns ? filteredRuns : filteredRuns.slice(0, 2)).map((run: any) => (
                    <div key={run.id} className="bg-card border border-border rounded-[24px] p-5 shadow-sm shrink-0">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary overflow-hidden shrink-0">
                          <Sunrise size={24} />
                        </div>
                        <div>
                          <p className="font-medium text-sm text-foreground">
                            {new Date(run.startTime).toLocaleDateString("ru-RU", { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </p>
                          <p className="text-sm text-muted mt-0.5">{run.event ? run.event.title : "Свободная пробежка"}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 w-full">
                        <div className="flex flex-col">
                          <span className="text-xl font-black">{run.distance.toFixed(2).replace('.', ',')}</span>
                          <span className="text-[10px] text-muted uppercase font-bold tracking-wider mt-1">КМ</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xl font-black">{formatPace(run.avgPace)}</span>
                          <span className="text-[10px] text-muted uppercase font-bold tracking-wider mt-1">Средн. темп</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xl font-black">{formatTime(run.durationSec)}</span>
                          <span className="text-[10px] text-muted uppercase font-bold tracking-wider mt-1">Время</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!showAllRuns && filteredRuns.length > 2 && (
                    <button 
                      onClick={() => setShowAllRuns(true)}
                      className="w-full py-4 rounded-[24px] border border-border bg-card/50 text-primary font-bold text-sm hover:bg-card transition-colors"
                    >
                      Показать все пробежки ({filteredRuns.length})
                    </button>
                  )}
                </>
              ) : (
                <div className="p-8 text-center bg-card rounded-[24px] border border-border text-muted">
                  В этом периоде нет пробежек.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
