import { X } from "lucide-react";
import { getRankStyle } from "./AvatarProgress";

const ranks = [
  { distance: 0, label: "0 - 49 км", name: "Неон" },
  { distance: 50, label: "50 - 249 км", name: "Белый" },
  { distance: 250, label: "250 - 999 км", name: "Бирюзовый" },
  { distance: 1000, label: "1000 - 2499 км", name: "Синий" },
  { distance: 2500, label: "2500 - 4999 км", name: "Серебряный" },
  { distance: 5000, label: "5000 - 14999 км", name: "Золотой" },
  { distance: 15000, label: "15000+ км", name: "Темная материя" },
];

export function RankInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex justify-center pointer-events-none">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm pointer-events-auto" onClick={onClose}></div>
      <div className="w-full max-w-[480px] h-full relative pointer-events-none flex flex-col justify-end">
        <div className="w-full max-h-[85vh] overflow-y-auto bg-card border-t border-border rounded-t-[32px] p-6 pb-12 pointer-events-auto relative z-10 animate-in slide-in-from-bottom-full duration-300 shadow-2xl" style={{ scrollbarWidth: 'none' }}>
          <div className="flex justify-between items-center mb-6 sticky top-0 bg-card z-20 py-2">
            <h2 className="text-2xl font-black uppercase tracking-tight">Ранги</h2>
            <button onClick={onClose} className="w-10 h-10 bg-background rounded-full flex items-center justify-center text-foreground hover:bg-border transition-colors shrink-0">
              <X size={20} />
            </button>
          </div>
          <p className="text-sm text-muted mb-6">Цвет кольца вокруг аватарки показывает твой статус и зависит от общего километража за всё время.</p>
          
          <div className="space-y-3">
            {ranks.map((r, i) => {
              const style = getRankStyle(r.distance);
              const isGrad = style.type === "gradient";
              return (
                <div key={i} className="flex items-center gap-4 bg-background border border-border rounded-2xl p-4">
                  <div className="w-12 h-12 rounded-full relative shrink-0">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      {isGrad && (
                        <defs>
                          <linearGradient id={`${style.id}-legend`} x1="0%" y1="0%" x2="100%" y2="100%">
                            {style.stops?.map((stop: any, idx: number) => (
                              <stop key={idx} offset={stop.offset} stopColor={stop.color} />
                            ))}
                          </linearGradient>
                        </defs>
                      )}
                      <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                      <circle cx="50" cy="50" r="46" fill="none" stroke={isGrad ? `url(#${style.id}-legend)` : style.color} strokeWidth="8" />
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-foreground text-sm">{r.name}</span>
                    <span className="text-[10px] text-muted font-bold tracking-wider uppercase mt-1">{r.label}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
