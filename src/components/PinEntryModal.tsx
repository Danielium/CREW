import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface PinEntryModalProps {
  eventId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PinEntryModal({ eventId, onClose, onSuccess }: PinEntryModalProps) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async () => {
    if (pin.length !== 4) return;
    setLoading(true);
    try {
      const res = await fetch("/api/events/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, pin }),
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        onSuccess?.();
        router.refresh();
        onClose();
      } else {
        setError(data.error || "Неверный код");
        setPin("");
      }
    } catch (err) {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-3xl p-8 max-w-sm w-full relative flex flex-col items-center shadow-2xl animate-in slide-in-from-bottom-10 duration-300">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted hover:text-foreground transition-colors z-50"
        >
          <X size={24} />
        </button>

        <h2 className="text-2xl font-black uppercase tracking-wider mb-2 mt-4 text-center">Введите PIN-код</h2>
        <p className="text-center text-muted text-sm mb-6">
          Узнайте 4-значный код у организатора пробежки
        </p>

        {/* Interactive PIN Container */}
        <div className="relative w-full flex justify-center mb-6">
          <input
            autoFocus
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, "");
              if (val.length <= 4) {
                setPin(val);
                setError(null);
              }
            }}
            disabled={loading}
            className="absolute inset-0 opacity-0 w-full h-full z-20 cursor-text"
          />
          
          {/* Visual PIN Display */}
          <div className="flex gap-4 relative z-10 pointer-events-none">
            {[0, 1, 2, 3].map(i => (
              <div 
                key={i} 
                className={`w-14 h-16 rounded-2xl flex items-center justify-center text-3xl font-black font-mono border-2 transition-all ${
                  pin[i] 
                    ? 'border-primary bg-primary/10 text-foreground' 
                    : 'border-border bg-background text-muted'
                } ${error ? 'border-red-500 bg-red-500/10' : ''}`}
              >
                {pin[i] || ""}
              </div>
            ))}
          </div>
        </div>

        {error && <div className="text-red-500 text-sm font-bold mb-4">{error}</div>}

        <button
          onClick={handleSubmit}
          disabled={loading || pin.length !== 4}
          className="w-full h-14 rounded-2xl bg-primary text-black text-xl font-bold hover:bg-[#b3e600] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center relative z-30"
        >
          {loading ? <Loader2 className="animate-spin" size={24} /> : "Чекин"}
        </button>
      </div>
    </div>
  );
}
