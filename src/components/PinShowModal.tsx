import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import * as OTPAuth from "otpauth";

interface PinShowModalProps {
  eventId: string;
  onClose: () => void;
}

export default function PinShowModal({ eventId, onClose }: PinShowModalProps) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState<string>("");
  const [remaining, setRemaining] = useState<number>(60);
  const period = 60;

  useEffect(() => {
    fetch(`/api/events/${eventId}/pin`)
      .then(r => r.json())
      .then(data => {
        if (data.token) {
          setToken(data.token);
        } else {
          setError(data.error || "Ошибка загрузки PIN-кода");
        }
      })
      .catch(() => setError("Ошибка соединения"));
  }, [eventId]);

  useEffect(() => {
    if (!token) return;

    const totp = new OTPAuth.TOTP({
      algorithm: "SHA1",
      digits: 4,
      period: period,
      secret: OTPAuth.Secret.fromHex(token)
    });

    const updatePin = () => {
      setPin(totp.generate());
      const epoch = Math.floor(Date.now() / 1000);
      setRemaining(period - (epoch % period));
    };

    updatePin();
    const interval = setInterval(updatePin, 1000);
    return () => clearInterval(interval);
  }, [token]);

  const dashArray = 2 * Math.PI * 40; // 40 is radius
  const dashOffset = dashArray - (dashArray * remaining) / period;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-3xl p-8 max-w-sm w-full relative flex flex-col items-center shadow-2xl animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted hover:text-foreground transition-colors"
        >
          <X size={24} />
        </button>

        <h2 className="text-2xl font-black uppercase tracking-wider mb-2">PIN-код пробежки</h2>
        <p className="text-center text-muted text-sm mb-8">
          Участники должны ввести этот код в приложении, чтобы присоединиться. Код обновляется каждую минуту.
        </p>

        {error ? (
          <div className="text-red-500 font-medium p-4 bg-red-500/10 rounded-xl">{error}</div>
        ) : !token ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="animate-spin text-primary" size={32} />
            <span className="text-muted">Генерация кода...</span>
          </div>
        ) : (
          <div className="flex items-center gap-6 py-6 px-8 bg-background border border-border rounded-2xl shadow-inner">
            <span className="text-6xl font-black tracking-widest font-mono text-foreground">{pin}</span>
            <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
              <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-border"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="8"
                  className={remaining <= 10 ? "text-red-500 transition-all duration-1000 linear" : "text-primary transition-all duration-1000 linear"}
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-xs font-bold font-mono">{remaining}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
