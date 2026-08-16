"use client";

/*
 * ─────────────────────────────────────────────────────────────────────────
 * THESIS: Прогресс цели — это маршрут, а не полоска загрузки. Экран
 *   отказывается от связки «большая цифра + прогресс-бар + сетка карточек»,
 *   которую отгружает любой фитнес-трекер.
 * OWN-WORLD: Мир CREW без изменений — чёрный фон, лайм #CCFF00 как
 *   единственный акцент, карточки bg-card/40 + border-white/5 + r22, Manrope.
 *   Новый элемент один: трек — SVG-полилиния в той же графике, которой
 *   приложение рисует маршруты на карте (routeData), с километровыми
 *   засечками поперёк линии.
 * STORY: На старте цель НЕ взята — ведёт каталог акций. Взял → появляется
 *   трек, и экран превращается в «сколько мне осталось до награды».
 * FIRST VIEWPORT: Без активной цели — заголовок, строка про то, как это
 *   работает, и карточки акций с наградой и действием «Взять цель».
 *   С активной целью — карточка контракта с треком во всю ширину, каталог ниже.
 * FORM: Маршрут-как-прогресс, кандидат 3 из упорядоченного списка структур,
 *   seed 9558a2ae.
 * MOTION: Один авторский момент — при открытии дистанция пробегается заново:
 *   трек прочерчивается, маркер едет по кривой, километровые засечки и
 *   отметки наград загораются в момент прохождения.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the
 *   finish review, the verdict, and DESIGN.md
 * ─────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check, ChevronRight, ChevronDown, Flag, Lock, MapPin, Gift, Flame, Route as RouteIcon, Loader2, PartyPopper, X, Ban } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";

type Tier = { at: number; reward: string };
export type Goal = {
  id: string;
  partner: string;
  title: string;
  metric: "km" | "streak";
  target: number;
  reward: string;
  city: string;
  claim: "promo" | "qr";
  tiers: Tier[];
  remainingCodes: number | null; // null — не PROMO (QR не завязан на пул)
};
type ActiveGoal = Goal & { progress: number };

/* ── Данные с сервера ─────────────────────────────────────────────────── */

type ApiChallenge = {
  id: string; slug: string; partner: string; title: string;
  metric: "KM" | "STREAK"; target: number; city: string;
  claimType: "PROMO" | "QR"; rewardLabel: string; remainingCodes: number | null;
};
type ApiParticipation = {
  id: string; challengeId: string; status: string; progress: number;
  activatedAt: string; completedAt: string | null;
  challenge: ApiChallenge;
};
type ApiResponse = {
  challenges: ApiChallenge[];
  active: ApiParticipation | null;
  paused: ApiParticipation[];
  completed: ApiParticipation | null;
  stravaConnected: boolean;
};

const toGoal = (c: ApiChallenge): Goal => ({
  id: c.id,
  partner: c.partner,
  title: c.title,
  metric: c.metric === "KM" ? "km" : "streak",
  target: c.target,
  reward: c.rewardLabel,
  city: c.city,
  claim: c.claimType === "PROMO" ? "promo" : "qr",
  tiers: [{ at: c.target, reward: c.rewardLabel }],
  remainingCodes: c.remainingCodes,
});
const toActiveGoal = (p: ApiParticipation): ActiveGoal => ({ ...toGoal(p.challenge), progress: p.progress });

const TRACK = "M 26 224 C 70 214, 84 176, 62 150 C 40 124, 66 92, 108 96 C 150 100, 168 74, 152 48 C 140 28, 168 12, 200 20 C 236 29, 248 58, 236 84 C 226 106, 246 124, 272 122";
const VB = { w: 300, h: 250 };
// Шаг километровых засечек подбираем под дистанцию: на 15 км засечки через
// 10 км дали бы одну штуку, на 200 км — двадцать. Целимся в 4–7 штук.
const tickStep = (target: number) => {
  const nice = [1, 2, 5, 10, 25, 50, 100];
  return nice.find((s) => target / s <= 7) ?? 100;
};
const DRAW_MS = 1500;
const CITY_ALL = "Все города";

type Pt = { x: number; y: number };
type Tick = { x: number; y: number; nx: number; ny: number; frac: number };

const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
};

const goalMetric = (g: Goal) => (g.metric === "km" ? `${g.target} км` : `${g.target} ${plural(g.target, "день", "дня", "дней")} подряд`);
const codesWord = (n: number) => plural(n, "промокод", "промокода", "промокодов");

/* ── Карточка активной цели ──────────────────────────────────────────────
 * Только для ДЕЙСТВИТЕЛЬНО взятой цели. Акции, которые ещё можно взять,
 * сюда не попадают ни при каких обстоятельствах — они живут строчками
 * в каталоге ниже, при любом их количестве. Хочешь взять — идёшь в список.
 */

function GoalCard({ goal }: { goal: ActiveGoal }) {
  const pathRef = useRef<SVGPathElement>(null);
  const progressRef = useRef<SVGPathElement>(null);
  const markerRef = useRef<SVGGElement>(null);
  const kmBoxRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const tierLabelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const tickRefs = useRef<(SVGLineElement | null)[]>([]);
  const trackWrapRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);

  const [geo, setGeo] = useState<{ len: number; tiers: Pt[]; ticks: Tick[] } | null>(null);
  const [lit, setLit] = useState<boolean[]>([]);
  const [arrived, setArrived] = useState(false);
  const [nudges, setNudges] = useState<number[]>([]);
  const [onScreen, setOnScreen] = useState(true);

  const frac = Math.min(1, goal.progress / goal.target);
  const nextTier = goal.tiers.find((t) => t.at > goal.progress);

  // Геометрия: точки наград и километровые засечки с нормалями
  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const len = path.getTotalLength();

    const tiers = goal.tiers.map((t) => {
      const p = path.getPointAtLength(len * Math.min(1, t.at / goal.target));
      return { x: p.x, y: p.y };
    });

    const ticks: Tick[] = [];
    const step = tickStep(goal.target);
    for (let km = step; km < goal.target; km += step) {
      if (goal.tiers.some((t) => t.at === km)) continue;
      const f = km / goal.target;
      const a = path.getPointAtLength(len * f);
      const b = path.getPointAtLength(Math.min(len, len * f + 1));
      const dx = b.x - a.x, dy = b.y - a.y;
      const m = Math.hypot(dx, dy) || 1;
      ticks.push({ x: a.x, y: a.y, nx: -dy / m, ny: dx / m, frac: f });
    }

    setGeo({ len, tiers, ticks });
  }, [goal]);

  // Авторский момент: дистанция пробегается заново
  useEffect(() => {
    if (!geo) return;
    const path = pathRef.current, prog = progressRef.current, marker = markerRef.current;
    if (!path || !prog || !marker) return;

    const tierFr = goal.tiers.map((t) => Math.min(1, t.at / goal.target));
    const fired = goal.tiers.map(() => false);

    const apply = (t: number) => {
      prog.style.strokeDashoffset = String(geo.len - geo.len * t);
      const p = path.getPointAtLength(geo.len * t);
      marker.setAttribute("transform", `translate(${p.x} ${p.y})`);
      marker.style.opacity = t > 0.005 ? "1" : "0";
      if (kmBoxRef.current) {
        kmBoxRef.current.style.left = `${(p.x / VB.w) * 100}%`;
        kmBoxRef.current.style.top = `${(p.y / VB.h) * 100}%`;
        kmBoxRef.current.style.opacity = t > 0.06 ? "1" : "0";
      }
      if (labelRef.current) labelRef.current.textContent = (t * goal.target).toFixed(1);
      geo.ticks.forEach((tk, i) => {
        const el = tickRefs.current[i];
        if (el) el.setAttribute("stroke", t >= tk.frac ? "var(--primary)" : "#2A2A2C");
      });
      tierFr.forEach((f, i) => {
        if (!fired[i] && t >= f) {
          fired[i] = true;
          setLit((prev) => { const n = [...prev]; n[i] = true; return n; });
        }
      });
    };

    // Конечное состояние — состояние по умолчанию: если кадры не пойдут
    // (фоновая вкладка, троттлинг WebView), виден прогресс, а не пустой трек.
    apply(frac);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || document.hidden) {
      setArrived(true);
      return;
    }

    let raf = 0;
    let done = false;
    const finish = () => { if (done) return; done = true; apply(frac); setArrived(true); };
    const start = performance.now();
    const step = (now: number) => {
      const x = Math.min(1, (now - start) / DRAW_MS);
      apply(frac * easeOutExpo(x));
      if (x < 1) raf = requestAnimationFrame(step);
      else finish();
    };
    apply(0);
    raf = requestAnimationFrame(step);
    const guard = window.setTimeout(finish, DRAW_MS + 500);

    return () => { cancelAnimationFrame(raf); window.clearTimeout(guard); };
  }, [geo, frac, goal]);

  // Разводим подписи. Конфликты считаем ПО ТОЧКАМ МАРШРУТА, а не по позициям
  // самих подписей: измерять то, что двигаешь, — верный путь к дрожанию.
  useLayoutEffect(() => {
    if (!geo) return;
    const wrap = trackWrapRef.current;
    if (!wrap) return;

    let cancelled = false;
    const resolve = () => {
      if (cancelled) return;
      const W = wrap.clientWidth, H = wrap.clientHeight;
      if (!W || !H) return;

      const box = (i: number) => {
        const el = tierLabelRefs.current[i];
        const p = geo.tiers[i];
        if (!el || !p) return null;
        const w = el.offsetWidth, h = el.offsetHeight;
        const cx = (p.x / VB.w) * W, cy = (p.y / VB.h) * H;
        const left = p.x > VB.w * 0.62 ? cx - 22 - w : cx + 22;
        return { left, right: left + w, top: cy - h / 2, bottom: cy + h / 2 };
      };

      const markerP = pathRef.current?.getPointAtLength(geo.len * frac);
      const kmEl = kmBoxRef.current;
      const kmRect = markerP && kmEl
        ? (() => {
            const w = kmEl.offsetWidth, h = kmEl.offsetHeight;
            const cx = (markerP.x / VB.w) * W, cy = (markerP.y / VB.h) * H;
            return { left: cx - w / 2, right: cx + w / 2, top: cy - h * 1.9, bottom: cy - h * 0.9 };
          })()
        : null;

      const MIN_V = 18, MIN_H = 28;
      type R = { left: number; right: number; top: number; bottom: number };
      const hits = (a: R, b: R) =>
        Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom) < MIN_V &&
        Math.max(a.left, b.left) - Math.min(a.right, b.right) < MIN_H;

      const bases = geo.tiers.map((_, i) => box(i));
      const next = bases.map(() => 0);
      const placed: R[] = kmRect ? [kmRect] : [];

      bases
        .map((b, i) => ({ b, i }))
        .filter((x): x is { b: R; i: number } => !!x.b)
        .sort((x, y) => x.b.top - y.b.top)
        .forEach(({ b, i }) => {
          let shift = 0;
          for (const p of placed) {
            const moved = { ...b, top: b.top + shift, bottom: b.bottom + shift };
            if (hits(moved, p)) shift += p.bottom - moved.top + MIN_V;
          }
          next[i] = Math.ceil(shift);
          placed.push({ ...b, top: b.top + next[i], bottom: b.bottom + next[i] });
        });

      setNudges((prev) => (next.every((v, i) => v === (prev[i] ?? 0)) ? prev : next));
    };

    resolve();
    document.fonts?.ready.then(resolve);
    const ro = new ResizeObserver(resolve);
    ro.observe(wrap);
    return () => { cancelled = true; ro.disconnect(); };
  }, [geo, frac]);

  // Пульс маркера не крутится, когда карточка ушла с экрана
  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={cardRef} className="mx-4 bg-card/40 backdrop-blur-md border border-white/5 rounded-[22px] overflow-hidden">
      <header className="flex items-center gap-3 px-5 pt-5">
        <div className="w-11 h-11 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
          <Gift size={19} className="text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold text-[17px] leading-tight truncate">{goal.title}</p>
          <p className="text-[13px] text-muted truncate">{goal.partner}</p>
        </div>
      </header>

      <div ref={trackWrapRef} className="relative mt-4 mx-3">
        <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="w-full block" aria-hidden="true">
          <defs>
            <filter id="trackGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <path ref={pathRef} d={TRACK} fill="none" stroke="#2A2A2C" strokeWidth={4} strokeLinecap="round" />

          {geo?.ticks.map((tk, i) => (
            <line
              key={i}
              ref={(el) => { tickRefs.current[i] = el; }}
              x1={tk.x + tk.nx * 5} y1={tk.y + tk.ny * 5}
              x2={tk.x - tk.nx * 5} y2={tk.y - tk.ny * 5}
              stroke="#2A2A2C" strokeWidth={2} strokeLinecap="round"
              style={{ transition: "stroke 220ms ease-out" }}
            />
          ))}

          {geo && (
            <path
              ref={progressRef} d={TRACK} fill="none" stroke="var(--primary)" strokeWidth={4}
              strokeLinecap="round" filter="url(#trackGlow)"
              style={{ strokeDasharray: geo.len, strokeDashoffset: geo.len }}
            />
          )}

          <circle cx={26} cy={224} r={4} fill="#0A0A0A" stroke="#3A3A3C" strokeWidth={2} />

          {geo?.tiers.map((p, i) => {
            const isLit = lit[i];
            const isNext = !isLit && goal.tiers[i].at === nextTier?.at;
            return (
              <g key={i}>
                {isLit && <circle cx={p.x} cy={p.y} r={8} fill="none" stroke="var(--primary)" strokeWidth={2} className="split-pulse" />}
                <circle
                  cx={p.x} cy={p.y} r={isLit ? 8 : 7}
                  fill={isLit ? "var(--primary)" : "#0A0A0A"}
                  stroke={isLit ? "var(--primary)" : isNext ? "var(--primary)" : "#3A3A3C"}
                  strokeWidth={2.5}
                  style={{ transition: "fill 260ms ease-out, stroke 260ms ease-out, r 260ms cubic-bezier(0.16,1,0.3,1)" }}
                />
              </g>
            );
          })}

          <g ref={markerRef} style={{ opacity: 0, transition: "opacity 200ms ease-out" }}>
            {arrived && onScreen && <circle r={13} fill="var(--primary)" className="breathe" />}
            <circle r={6} fill="var(--primary)" stroke="#000" strokeWidth={2.5} />
          </g>
        </svg>

        {geo?.tiers.map((p, i) => {
          const t = goal.tiers[i];
          const isLit = lit[i];
          const isLast = i === goal.tiers.length - 1;
          const flip = p.x > VB.w * 0.62;
          return (
            <div
              key={i}
              ref={(el) => { tierLabelRefs.current[i] = el; }}
              // Фиксированная ширина, не shrink-to-fit: контейнер абсолютно
              // спозиционирован без width, и text-right внутри такого блока
              // на разных строках схлопывал ширину до самого узкого слова
              // («Напиток / в / подарок» — по одному слову на строку).
              className={`absolute pointer-events-none w-[112px] ${flip ? "text-right" : ""}`}
              style={{
                left: `${(p.x / VB.w) * 100}%`,
                top: `${(p.y / VB.h) * 100}%`,
                transform: `translate(${flip ? "calc(-100% - 22px)" : "22px"}, calc(-50% + ${nudges[i] ?? 0}px))`,
                transition: "transform 200ms ease-out",
              }}
            >
              <div className={`flex items-center gap-1.5 whitespace-nowrap ${flip ? "justify-end" : ""}`}>
                {isLast ? <Flag size={12} className={isLit ? "text-primary" : "text-muted"} />
                  : isLit ? <Check size={12} className="text-primary" />
                  : <Lock size={12} className="text-muted" />}
                <span className={`font-display text-[13px] font-bold transition-colors duration-300 ${isLit ? "text-foreground" : "text-muted"}`}>
                  {t.at} км
                </span>
              </div>
              <p className={`text-[11px] leading-tight mt-0.5 transition-colors duration-300 ${isLit ? "text-primary" : "text-muted"}`}>
                {t.reward}
              </p>
            </div>
          );
        })}

        <div
          ref={kmBoxRef}
          className="absolute pointer-events-none whitespace-nowrap font-display text-[19px] font-extrabold tracking-[-0.03em] text-foreground bg-background/85 rounded-full px-2.5 py-0.5"
          style={{ transform: "translate(-50%, -190%)", opacity: 0, transition: "opacity 300ms ease-out" }}
        >
          <span ref={labelRef}>0</span>
          <span className="font-display text-[13px] font-bold text-muted ml-1">км</span>
        </div>
      </div>

      <footer className="px-5 pb-5 pt-1">
        <p className="text-[13px] text-muted">
          {nextTier ? (
            <>
              До награды —{" "}
              <span className="text-foreground font-bold">{(nextTier.at - goal.progress).toFixed(1)} км</span>
              . Придёт сообщением от бота в Telegram, как только доберёшься.
            </>
          ) : (
            "Цель выполнена — награда уже в Telegram"
          )}
        </p>
        {goal.claim === "promo" && goal.remainingCodes !== null && !!nextTier && (
          <p className="text-[11px] text-muted mt-1.5">
            Осталось {goal.remainingCodes} {codesWord(goal.remainingCodes)} в пуле
          </p>
        )}
      </footer>
    </section>
  );
}

/* ── Пустое состояние: цель не выбрана ───────────────────────────────────
 * Тот же трек, что и у активной цели, но нетронутый — пунктиром, без
 * засечек, без маркера, без наград. Честная картинка: пока нечего
 * показывать, потому что ничего не взято. Действие — только в списке ниже,
 * эта карточка сама никогда не кликабельна и не притворяется кнопкой.
 */
function EmptyGoalCard({ hasCatalog }: { hasCatalog: boolean }) {
  return (
    <section className="mx-4 bg-card/40 backdrop-blur-md border border-white/5 rounded-[22px] overflow-hidden">
      <div className="relative mt-3 mx-3">
        <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="w-full block" aria-hidden="true">
          <path
            d={TRACK} fill="none" stroke="#232325" strokeWidth={4}
            strokeLinecap="round" strokeDasharray="1 11"
          />
          <circle cx={26} cy={224} r={4} fill="#0A0A0A" stroke="#333335" strokeWidth={2} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-10">
          <p className="font-display text-[17px] font-bold text-foreground">Цель не выбрана</p>
          <p className="text-[13px] text-muted mt-1 max-w-[230px] leading-relaxed">
            {hasCatalog
              ? "Возьми одну из списка ниже — километры сразу начнут копиться в неё"
              : "Пока нет ни одной цели — загляни позже"}
          </p>
        </div>
      </div>
      {hasCatalog && (
        <div className="flex justify-center pb-3">
          <ChevronDown size={18} className="text-muted nudge-down" />
        </div>
      )}
    </section>
  );
}

/* ── Экран ────────────────────────────────────────────────────────────── */

export default function ChallengesTab() {
  const { status: sessionStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const [city, setCity] = useState(CITY_ALL);
  const [claim, setClaim] = useState<"all" | "promo" | "qr">("all");
  const [shown, setShown] = useState(5);

  const fetchChallenges = async () => {
    try {
      const res = await fetch("/api/challenges", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchChallenges(); }, []);

  // Возврат из Strava (см. /api/strava/callback): сообщаем, что случилось,
  // и убираем параметры из адресной строки, чтобы не сработали повторно.
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    if (!success && !error) return;

    if (success === "goal_activated") setBanner({ kind: "success", text: "Цель взята! Километры уже считаются." });
    else if (error === "activation_failed") setBanner({ kind: "error", text: "Strava подключилась, а цель — нет. Попробуй взять её ещё раз." });
    else if (error === "strava_auth_failed" || error === "token_exchange_failed") setBanner({ kind: "error", text: "Не получилось подключить Strava. Попробуй ещё раз." });
    else if (error === "strava_already_linked") setBanner({ kind: "error", text: "Этот аккаунт Strava уже привязан к другому профилю CREW." });

    router.replace("/challenges");
    fetchChallenges();
  }, [searchParams]);

  const handleActivate = async (challengeId: string) => {
    if (sessionStatus !== "authenticated") return;
    triggerHaptic("light");
    setActionError(null);
    setActivatingId(challengeId);
    try {
      const res = await fetch(`/api/challenges/${challengeId}/activate`, { method: "POST" });
      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        if (body.error === "STRAVA_REQUIRED") {
          const returnTo = encodeURIComponent("/challenges");
          window.location.href = `/api/strava/connect?returnTo=${returnTo}&challengeId=${challengeId}`;
          return;
        }
        setActionError(body.error || "Эту цель сейчас нельзя взять");
        setActivatingId(null);
        return;
      }
      if (!res.ok) {
        setActionError("Не получилось. Попробуй ещё раз.");
        setActivatingId(null);
        return;
      }
      await fetchChallenges();
    } catch (e) {
      console.error(e);
      setActionError("Не получилось. Попробуй ещё раз.");
    } finally {
      setActivatingId(null);
    }
  };

  const active = data?.active ? toActiveGoal(data.active) : null;
  // API отдаёт активную цель и внутри challenges тоже (её можно взять
  // повторно после паузы) — но в «Других целях» ей делать нечего, она уже
  // и так на экране в виде карточки выше.
  const catalog = useMemo(
    () => (data?.challenges ?? []).filter((c) => c.id !== active?.id).map(toGoal),
    [data, active]
  );

  const filtered = useMemo(
    () =>
      catalog.filter(
        (c) => (city === CITY_ALL || c.city === city || c.city === "Везде") && (claim === "all" || c.claim === claim)
      ),
    [catalog, city, claim]
  );

  const cities = useMemo(
    () => [...new Set(catalog.map((c) => c.city).filter((c) => c !== "Везде"))],
    [catalog]
  );

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-[100dvh] items-center justify-center pt-safe pb-28">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] text-foreground pb-28 pt-safe relative z-10">
      <h1 className="px-4 mt-2 mb-4 font-display text-[30px] font-extrabold tracking-[-0.03em] leading-none">
        Цели
      </h1>

      {banner && (
        <div
          className={`mx-4 mb-4 rounded-[16px] border px-4 py-3 flex items-start gap-2.5 ${
            banner.kind === "success" ? "bg-primary/10 border-primary/25 text-foreground" : "bg-white/[0.04] border-white/10 text-muted"
          }`}
        >
          <p className="text-[13px] leading-snug flex-1">{banner.text}</p>
          <button
            onClick={() => setBanner(null)}
            aria-label="Закрыть"
            className="shrink-0 -m-2.5 p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted hover:text-foreground"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {data?.completed && !active && (
        <div className="mx-4 mb-4 bg-card/40 backdrop-blur-md border border-primary/20 rounded-[22px] px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <PartyPopper size={18} className="text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-[15px] leading-tight">«{data.completed.challenge.title}» выполнена</p>
            <p className="text-[13px] text-muted mt-0.5">Награда от {data.completed.challenge.partner} уже пришла в Telegram</p>
          </div>
        </div>
      )}

      {actionError && (
        <p className="mx-4 mb-3 text-[13px] text-red-400">{actionError}</p>
      )}

      {active ? <GoalCard goal={active} /> : <EmptyGoalCard hasCatalog={catalog.length > 0} />}

      {/* Каталог — список при любом количестве акций, хоть одна, хоть сто.
          Взять цель можно только отсюда, никогда из карточки выше. */}
      <div className={`px-4 mt-8`}>
        {active ? (
          <>
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-[19px] font-bold tracking-[-0.02em]">Другие цели</h2>
              <span className="text-[13px] text-muted">
                {filtered.length} {plural(filtered.length, "цель", "цели", "целей")}
              </span>
            </div>
            <p className="text-[13px] text-muted mt-1">
              Возьмёшь другую — текущая встанет на паузу, накопленные километры сохранятся
            </p>
          </>
        ) : catalog.length > 0 ? (
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[19px] font-bold tracking-[-0.02em]">Доступные цели</h2>
            <span className="text-[13px] text-muted">
              {filtered.length} {plural(filtered.length, "цель", "цели", "целей")}
            </span>
          </div>
        ) : null}
      </div>

      {catalog.length > 1 && (
        <div className="flex gap-2 px-4 mt-3 overflow-x-auto no-scrollbar">
          {[...cities, CITY_ALL].map((c) => (
            <button
              key={c}
              onClick={() => { triggerHaptic("light"); setCity(c); setShown(5); }}
              className={`shrink-0 min-h-[44px] flex items-center gap-1.5 px-3.5 rounded-full text-[13px] font-bold border transition-[transform,background-color,color,border-color] duration-200 active:scale-[0.96] ${
                city === c ? "bg-primary text-black border-primary" : "bg-card/40 text-muted border-border hover:text-foreground"
              }`}
            >
              <MapPin size={13} strokeWidth={2.5} />
              {c}
            </button>
          ))}
          <div className="shrink-0 w-px bg-border mx-1 my-1.5" />
          {([["all", "Любой способ"], ["promo", "Промокод"], ["qr", "QR на месте"]] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => { triggerHaptic("light"); setClaim(v); setShown(5); }}
              className={`shrink-0 min-h-[44px] flex items-center px-3.5 rounded-full text-[13px] font-bold border transition-[transform,background-color,color,border-color] duration-200 active:scale-[0.96] ${
                claim === v ? "bg-primary text-black border-primary" : "bg-card/40 text-muted border-border hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div key={`${city}-${claim}`} className="flex flex-col gap-2 px-4 mt-4">
        {catalog.length === 0 ? (
          <div className="row-in bg-card/40 border border-white/5 rounded-[22px] px-5 py-10 text-center">
            <p className="text-[15px] text-foreground font-bold mb-1">Пока ни одной акции</p>
            <p className="text-[13px] text-muted">
              Мы договариваемся с первыми партнёрами. Как только появится первая цель — она будет здесь.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="row-in bg-card/40 border border-white/5 rounded-[22px] px-5 py-8 flex flex-col items-center text-center">
            <p className="text-[15px] text-foreground font-bold mb-1">Ничего не подошло</p>
            <p className="text-[13px] text-muted mb-4">
              {city !== CITY_ALL && claim !== "all"
                ? `В городе ${city} целей с таким способом получения пока нет`
                : city !== CITY_ALL
                ? `В городе ${city} целей пока нет`
                : "Целей с таким способом получения пока нет"}
            </p>
            <button
              onClick={() => { triggerHaptic("light"); setCity(CITY_ALL); setClaim("all"); setShown(5); }}
              className="min-h-[44px] px-5 rounded-full border border-border text-[13px] font-bold text-foreground transition-[transform,border-color] duration-150 hover:border-white/20 active:scale-[0.97]"
            >
              Сбросить фильтры
            </button>
          </div>
        ) : (
          filtered.slice(0, shown).map((c, i) => {
            const exhausted = c.claim === "promo" && c.remainingCodes === 0;
            const scarce = c.claim === "promo" && c.remainingCodes !== null && c.remainingCodes > 0 && c.remainingCodes <= 3;
            return (
              <button
                key={c.id}
                onClick={() => handleActivate(c.id)}
                disabled={activatingId === c.id || exhausted}
                style={{ animationDelay: `${Math.min(i, 6) * 45}ms` }}
                className="row-in w-full text-left bg-card/40 backdrop-blur-md border border-white/5 rounded-[22px] px-4 py-4 flex items-center gap-3.5 transition-[transform,border-color] duration-200 hover:border-white/10 active:scale-[0.985] disabled:cursor-not-allowed disabled:saturate-0 disabled:brightness-90"
              >
                <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/5 flex items-center justify-center shrink-0">
                  {activatingId === c.id ? (
                    <Loader2 size={17} className="text-muted animate-spin" />
                  ) : exhausted ? (
                    <Ban size={16} className="text-muted" />
                  ) : c.metric === "streak" ? (
                    <Flame size={17} className="text-muted" />
                  ) : (
                    <RouteIcon size={17} className="text-muted" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-[15px] leading-tight truncate">{c.title}</p>
                    {c.claim === "promo" && c.remainingCodes !== null && !exhausted && (
                      <span className={`shrink-0 text-[11px] font-bold ${scarce ? "text-primary" : "text-muted"}`}>
                        {c.remainingCodes} {codesWord(c.remainingCodes)}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-muted truncate">{goalMetric(c)} · {c.partner}</p>
                  <p className={`text-[13px] truncate mt-0.5 ${exhausted ? "text-muted" : "text-primary"}`}>
                    {exhausted ? "Промокоды закончились" : c.reward}
                  </p>
                </div>
                {!exhausted && <ChevronRight size={18} className="text-muted shrink-0" />}
              </button>
            );
          })
        )}

        {filtered.length > shown && (
          <button
            onClick={() => { triggerHaptic("light"); setShown((s) => s + 5); }}
            className="w-full py-3.5 rounded-full border border-border text-[13px] font-bold text-muted transition-[transform,color,border-color] duration-200 hover:text-foreground hover:border-white/20 active:scale-[0.98] mt-1"
          >
            Показать ещё {filtered.length - shown}
          </button>
        )}
      </div>
    </div>
  );
}
