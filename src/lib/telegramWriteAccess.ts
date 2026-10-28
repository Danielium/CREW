// Ask Telegram to let the bot message the user, so notifications (join requests,
// answers, reminders) reach people who opened the Mini App via a direct link
// (t.me/<bot>/new, ?startapp=focus_/club_) and never pressed Start in the bot chat.
//
// Called right after actions whose outcome arrives as a bot message — never on app open.
// Shown at most once while undecided: a refusal is remembered and not repeated for
// DECLINE_COOLDOWN_MS; once allowed, Telegram itself reports allows_write_to_pm = true.

const STORAGE_KEY = "crew_bot_write_access";
const DECLINE_COOLDOWN_MS = 5 * 24 * 60 * 60 * 1000;

let inFlight = false;

function readState(): { status: "granted" | "declined"; at: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeState(status: "granted" | "declined") {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ status, at: Date.now() }));
  } catch {}
}

export function requestBotWriteAccess() {
  if (typeof window === "undefined" || inFlight) return;
  const tg = (window as any).Telegram?.WebApp;
  if (!tg?.initData || typeof tg.requestWriteAccess !== "function") return;
  if (typeof tg.isVersionAtLeast === "function" && !tg.isVersionAtLeast("6.9")) return;
  if (tg.initDataUnsafe?.user?.allows_write_to_pm) return;

  const state = readState();
  if (state?.status === "granted") return;
  if (state?.status === "declined" && Date.now() - state.at < DECLINE_COOLDOWN_MS) return;

  inFlight = true;
  try {
    tg.requestWriteAccess((allowed: boolean) => {
      inFlight = false;
      writeState(allowed ? "granted" : "declined");
    });
  } catch {
    inFlight = false;
  }
}
