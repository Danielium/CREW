"use client";

/*
 * ─────────────────────────────────────────────────────────────────────────
 * THESIS: Прогресс челленджа — это маршрут, а не полоска загрузки. Экран
 *   отказывается от связки «большая цифра + прогресс-бар + сетка карточек»,
 *   которую отгружает любой фитнес-трекер.
 * OWN-WORLD: Мир CREW без изменений — чёрный фон, лайм #CCFF00 как
 *   единственный акцент, карточки bg-card/40 + border-white/5 + r22, Manrope.
 *   Новый элемент один: трек — SVG-полилиния в той же графике, которой
 *   приложение рисует маршруты на карте (routeData), с километровыми
 *   засечками поперёк линии.
 * STORY: «Я вижу, где я на дистанции, сколько до следующей награды и что
 *   получу на финише» → активирует один челлендж → возвращается смотреть трек.
 * FIRST VIEWPORT: Заголовок, затем карточка активного контракта во всю ширину:
 *   партнёр и награда сверху, трек высотой ~250px с отметками уровней прямо на
 *   линии, маркер текущей позиции с километражом. Первичное действие — в нижней
 *   части карточки, в зоне большого пальца. Каталог с фильтрами — ниже сгиба.
 * FORM: Маршрут-как-прогресс, кандидат 3 из упорядоченного списка структур,
 *   seed 9558a2ae.
 * MOTION: Один авторский момент — при открытии дистанция пробегается заново:
 *   трек прочерчивается от старта, маркер едет по кривой, километровые засечки
 *   и отметки наград загораются ровно в момент прохождения. Всё остальное
 *   движение — обратная связь: каскад строк при смене фильтра, отклик нажатия.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the
 *   finish review, the verdict, and DESIGN.md
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ДАННЫЕ НИЖЕ СИНТЕТИЧЕСКИЕ — партнёры, награды и цифры выдуманы для показа
 * экрана. Ни одного реального партнёра у продукта пока нет.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, Flag, Lock, MapPin, Gift, Flame, Route as RouteIcon } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";

type Tier = { at: number; reward: string };
type Challenge = {
  id: string;
  partner: string;
  title: string;
  metric: "km" | "streak";
  target: number;
  reward: string;
  city: string;
  claim: "promo" | "qr";
};

const ACTIVE = {
  id: "c1",
  partner: "Кофейня у парка",
  title: "Разбег",
  metric: "km" as const,
  target: 100,
  progress: 34.2,
  city: "Москва",
  tiers: [
    { at: 25, reward: "Капучино" },
    { at: 50, reward: "Скидка 20%" },
    { at: 100, reward: "Кофе на месяц" },
  ] as Tier[],
};

const CATALOG: Challenge[] = [
  { id: "c2", partner: "Беговой магазин", title: "Сто километров осени", metric: "km", target: 100, reward: "Скидка 15% на кроссовки", city: "Москва", claim: "promo" },
  { id: "c3", partner: "CREW", title: "Семь дней подряд", metric: "streak", target: 7, reward: "Значок в профиле", city: "Везде", claim: "promo" },
  { id: "c4", partner: "Спортзал на Соколе", title: "Утренний старт", metric: "streak", target: 14, reward: "Неделя бесплатно", city: "Москва", claim: "qr" },
  { id: "c5", partner: "Пекарня", title: "Полсотни", metric: "km", target: 50, reward: "Завтрак", city: "Москва", claim: "qr" },
  { id: "c6", partner: "CREW", title: "Первые десять", metric: "km", target: 10, reward: "Значок новичка", city: "Везде", claim: "promo" },
  { id: "c7", partner: "Массажный салон", title: "Марафон месяца", metric: "km", target: 200, reward: "Сеанс восстановления", city: "Москва", claim: "qr" },
  { id: "c8", partner: "Кофейня на Свияге", title: "Тридцатка", metric: "km", target: 30, reward: "Раф в подарок", city: "Ульяновск", claim: "promo" },
];

// Маршрут — та же графика, которой приложение рисует треки на карте
const TRACK = "M 26 224 C 70 214, 84 176, 62 150 C 40 124, 66 92, 108 96 C 150 100, 168 74, 152 48 C 140 28, 168 12, 200 20 C 236 29, 248 58, 236 84 C 226 106, 246 124, 272 122";
const VB = { w: 300, h: 250 };
const TICK_EVERY = 10; // км между засечками
const DRAW_MS = 1500;

type Pt = { x: number; y: number };
type Tick = { x: number; y: number; nx: number; ny: number; frac: number };

const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));

// Русская плюрализация: 1 цель, 2 цели, 5 целей
const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
};

const CITY_ALL = "Все города";

export default function ChallengesTab() {
  const pathRef = useRef<SVGPathElement>(null);
  const progressRef = useRef<SVGPathElement>(null);
  const markerRef = useRef<SVGGElement>(null);
  const kmBoxRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const tierRefs = useRef<(SVGGElement | null)[]>([]);
  const tierLabelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const tickRefs = useRef<(SVGLineElement | null)[]>([]);
  const trackWrapRef = useRef<HTMLDivElement>(null);

  const [geo, setGeo] = useState<{ len: number; tiers: Pt[]; ticks: Tick[] } | null>(null);
  const [lit, setLit] = useState<boolean[]>([]);
  const [arrived, setArrived] = useState(false);
  const [nudges, setNudges] = useState<number[]>([]);

  const [city, setCity] = useState("Москва");
  const [claim, setClaim] = useState<"all" | "promo" | "qr">("all");
  const [shown, setShown] = useState(5);

  const frac = Math.min(1, ACTIVE.progress / ACTIVE.target);
  const nextTier = ACTIVE.tiers.find((t) => t.at > ACTIVE.progress);
  const reached = ACTIVE.tiers.filter((t) => t.at <= ACTIVE.progress).length;

  // 1. Геометрия трека: точки наград и километровые засечки с нормалями
  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const len = path.getTotalLength();

    const tiers = ACTIVE.tiers.map((t) => {
      const p = path.getPointAtLength(len * Math.min(1, t.at / ACTIVE.target));
      return { x: p.x, y: p.y };
    });

    const ticks: Tick[] = [];
    for (let km = TICK_EVERY; km < ACTIVE.target; km += TICK_EVERY) {
      if (ACTIVE.tiers.some((t) => t.at === km)) continue; // не дублируем награды
      const f = km / ACTIVE.target;
      const a = path.getPointAtLength(len * f);
      const b = path.getPointAtLength(Math.min(len, len * f + 1));
      const dx = b.x - a.x, dy = b.y - a.y;
      const m = Math.hypot(dx, dy) || 1;
      ticks.push({ x: a.x, y: a.y, nx: -dy / m, ny: dx / m, frac: f });
    }

    setGeo({ len, tiers, ticks });
  }, []);

  // 2. Авторский момент: дистанция пробегается заново
  useEffect(() => {
    if (!geo) return;
    const path = pathRef.current, prog = progressRef.current, marker = markerRef.current;
    if (!path || !prog || !marker) return;

    const tierFr = ACTIVE.tiers.map((t) => Math.min(1, t.at / ACTIVE.target));
    const fired = ACTIVE.tiers.map(() => false);

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
      if (labelRef.current) labelRef.current.textContent = (t * ACTIVE.target).toFixed(1);
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

    // Конечное состояние — состояние по умолчанию. Если анимация не
    // запустится (фоновая вкладка, троттлинг WebView, отключённое движение),
    // пользователь всё равно видит свой прогресс, а не пустой трек.
    apply(frac);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || document.hidden) {
      setArrived(true);
      return;
    }

    let raf = 0;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      apply(frac);
      setArrived(true);
    };
    const start = performance.now();
    const step = (now: number) => {
      const x = Math.min(1, (now - start) / DRAW_MS);
      apply(frac * easeOutExpo(x));
      if (x < 1) raf = requestAnimationFrame(step);
      else finish();
    };
    apply(0);
    raf = requestAnimationFrame(step);
    // страховка: если кадры не идут, досрочно показываем результат
    const guard = window.setTimeout(finish, DRAW_MS + 500);

    return () => { cancelAnimationFrame(raf); window.clearTimeout(guard); };
  }, [geo, frac]);

  // 3. Разводим подписи, которые встали слишком близко.
  //    Пересечения рамок мало: две подписи на одной строке в 15px друг от друга
  //    читаются как одна фраза. Считаем их конфликтом и раздвигаем по вертикали.
  useLayoutEffect(() => {
    if (!geo) return;
    const wrap = trackWrapRef.current;
    if (!wrap) return;

    let cancelled = false;
    const resolve = () => {
      if (cancelled) return;
      const W = wrap.clientWidth, H = wrap.clientHeight;
      if (!W || !H) return;

      // Базовые рамки считаем ОТ ТОЧЕК МАРШРУТА, а не от позиций самих
      // подписей: измерять то, что двигаешь, — верный путь к дрожанию.
      // От DOM берём только размеры текста.
      const box = (i: number) => {
        const el = tierLabelRefs.current[i];
        const p = geo.tiers[i];
        if (!el || !p) return null;
        const w = el.offsetWidth, h = el.offsetHeight;
        const cx = (p.x / VB.w) * W, cy = (p.y / VB.h) * H;
        const left = p.x > VB.w * 0.62 ? cx - 16 - w : cx + 16;
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

    // Ждём шрифты: до их загрузки высота подписей другая
    resolve();
    document.fonts?.ready.then(resolve);
    const ro = new ResizeObserver(resolve);
    ro.observe(wrap);
    return () => { cancelled = true; ro.disconnect(); };
  }, [geo, frac]);

  // 4. Пульс маркера не крутится, когда карточка ушла с экрана
  const cardRef = useRef<HTMLElement>(null);
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const filtered = useMemo(
    () =>
      CATALOG.filter(
        (c) => (city === "Все города" || c.city === city || c.city === "Везде") && (claim === "all" || c.claim === claim)
      ),
    [city, claim]
  );

  return (
    <div className="flex flex-col min-h-[100dvh] text-foreground pb-28 pt-safe relative z-10">
      <h1 className="px-4 mt-2 mb-4 font-display text-[30px] font-extrabold tracking-[-0.03em] leading-none">
        Цели
      </h1>

      {/* ── Активный контракт ─────────────────────────────────────────── */}
      <section ref={cardRef} className="mx-4 bg-card/40 backdrop-blur-md border border-white/5 rounded-[22px] overflow-hidden">
        <header className="flex items-center gap-3 px-5 pt-5">
          <div className="w-11 h-11 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
            <Gift size={19} className="text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold text-[17px] leading-tight truncate">{ACTIVE.title}</p>
            <p className="text-[13px] text-muted truncate">{ACTIVE.partner}</p>
          </div>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 rounded-full px-2.5 py-1">
            Активна
          </span>
        </header>

        {/* Трек */}
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

            {/* непройденная часть */}
            <path ref={pathRef} d={TRACK} fill="none" stroke="#2A2A2C" strokeWidth={4} strokeLinecap="round" />

            {/* километровые засечки */}
            {geo?.ticks.map((tk, i) => (
              <line
                key={i}
                ref={(el) => { tickRefs.current[i] = el; }}
                x1={tk.x + tk.nx * 5}
                y1={tk.y + tk.ny * 5}
                x2={tk.x - tk.nx * 5}
                y2={tk.y - tk.ny * 5}
                stroke="#2A2A2C"
                strokeWidth={2}
                strokeLinecap="round"
                style={{ transition: "stroke 220ms ease-out" }}
              />
            ))}

            {/* пройденная часть */}
            {geo && (
              <path
                ref={progressRef}
                d={TRACK}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={4}
                strokeLinecap="round"
                filter="url(#trackGlow)"
                style={{ strokeDasharray: geo.len, strokeDashoffset: geo.len }}
              />
            )}

            {/* старт */}
            <circle cx={26} cy={224} r={4} fill="#0A0A0A" stroke="#3A3A3C" strokeWidth={2} />

            {/* отметки наград */}
            {geo?.tiers.map((p, i) => {
              const isLit = lit[i];
              const isNext = !isLit && ACTIVE.tiers[i].at === nextTier?.at;
              return (
                <g key={i} ref={(el) => { tierRefs.current[i] = el; }}>
                  {isLit && (
                    <circle cx={p.x} cy={p.y} r={8} fill="none" stroke="var(--primary)" strokeWidth={2} className="split-pulse" />
                  )}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isLit ? 8 : 7}
                    fill={isLit ? "var(--primary)" : "#0A0A0A"}
                    stroke={isLit ? "var(--primary)" : isNext ? "var(--primary)" : "#3A3A3C"}
                    strokeWidth={2.5}
                    style={{ transition: "fill 260ms ease-out, stroke 260ms ease-out, r 260ms cubic-bezier(0.16,1,0.3,1)" }}
                  />
                </g>
              );
            })}

            {/* маркер текущей позиции */}
            <g ref={markerRef} style={{ opacity: 0, transition: "opacity 200ms ease-out" }}>
              {arrived && onScreen && <circle r={13} fill="var(--primary)" className="breathe" />}
              <circle r={6} fill="var(--primary)" stroke="#000" strokeWidth={2.5} />
            </g>
          </svg>

          {/* подписи наград */}
          {geo?.tiers.map((p, i) => {
            const t = ACTIVE.tiers[i];
            const isLit = lit[i];
            const isLast = i === ACTIVE.tiers.length - 1;
            const flip = p.x > VB.w * 0.62;
            return (
              <div
                key={i}
                ref={(el) => { tierLabelRefs.current[i] = el; }}
                className="absolute pointer-events-none"
                style={{
                  left: `${(p.x / VB.w) * 100}%`,
                  top: `${(p.y / VB.h) * 100}%`,
                  transform: `translate(${flip ? "calc(-100% - 16px)" : "16px"}, calc(-50% + ${nudges[i] ?? 0}px))`,
                  transition: "transform 200ms ease-out",
                }}
              >
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  {isLast ? (
                    <Flag size={12} className={isLit ? "text-primary" : "text-muted"} />
                  ) : isLit ? (
                    <Check size={12} className="text-primary" />
                  ) : (
                    <Lock size={12} className="text-muted" />
                  )}
                  <span className={`font-display text-[13px] font-bold transition-colors duration-300 ${isLit ? "text-foreground" : "text-muted"}`}>
                    {t.at} км
                  </span>
                </div>
                <p className={`text-[11px] leading-tight mt-0.5 max-w-[96px] transition-colors duration-300 ${isLit ? "text-primary" : "text-muted"} ${flip ? "text-right ml-auto" : ""}`}>
                  {t.reward}
                </p>
              </div>
            );
          })}

          {/* километраж, едущий вместе с маркером */}
          <div
            ref={kmBoxRef}
            className="absolute pointer-events-none whitespace-nowrap font-display text-[19px] font-extrabold tracking-[-0.03em] text-foreground bg-background/85 rounded-full px-2.5 py-0.5"
            style={{ transform: "translate(-50%, -190%)", opacity: 0, transition: "opacity 300ms ease-out" }}
          >
            <span ref={labelRef}>0</span>
            <span className="font-display text-[13px] font-bold text-muted ml-1">км</span>
          </div>
        </div>

        {/* подвал карточки */}
        <footer className="px-5 pb-5 pt-1">
          <p className="text-[13px] text-muted mb-3">
            {nextTier ? (
              <>
                Следующая награда через{" "}
                <span className="text-foreground font-bold">{(nextTier.at - ACTIVE.progress).toFixed(1)} км</span>
                {" "}— {nextTier.reward}
              </>
            ) : (
              "Цель закрыта, все награды забраны"
            )}
          </p>
          {reached > 0 && (
            <button
              onClick={() => triggerHaptic("light")}
              className="w-full bg-primary text-black font-bold text-[15px] py-3 rounded-full transition-[transform,background-color] duration-150 hover:bg-[#b3e600] active:scale-[0.97]"
            >
              Забрать награду
            </button>
          )}
        </footer>
      </section>

      {/* ── Каталог ───────────────────────────────────────────────────── */}
      <div className="mt-8 px-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[19px] font-bold tracking-[-0.02em]">Другие цели</h2>
          <span className="text-[13px] text-muted">
            {filtered.length} {plural(filtered.length, "цель", "цели", "целей")}
          </span>
        </div>
        <p className="text-[13px] text-muted mt-1">
          Возьмёшь другую — текущая встанет на паузу, накопленные километры сохранятся
        </p>
      </div>

      <div className="flex gap-2 px-4 mt-3 overflow-x-auto no-scrollbar">
        {["Москва", "Ульяновск", CITY_ALL].map((c) => (
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

      {/* key перезапускает каскад при смене фильтра — видно, что фильтр сработал */}
      <div key={`${city}-${claim}`} className="flex flex-col gap-2 px-4 mt-3">
        {filtered.length === 0 ? (
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
          filtered.slice(0, shown).map((c, i) => (
            <button
              key={c.id}
              onClick={() => triggerHaptic("light")}
              style={{ animationDelay: `${Math.min(i, 6) * 45}ms` }}
              className="row-in w-full text-left bg-card/40 backdrop-blur-md border border-white/5 rounded-[22px] px-4 py-4 flex items-center gap-3.5 transition-[transform,border-color] duration-200 hover:border-white/10 active:scale-[0.985]"
            >
              <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/5 flex items-center justify-center shrink-0">
                {c.metric === "streak" ? (
                  <Flame size={17} className="text-muted" />
                ) : (
                  <RouteIcon size={17} className="text-muted" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[15px] leading-tight truncate">{c.title}</p>
                <p className="text-[13px] text-muted truncate">
                  {c.metric === "km" ? `${c.target} км` : `${c.target} дней подряд`} · {c.partner}
                </p>
                <p className="text-[13px] text-primary truncate mt-0.5">{c.reward}</p>
              </div>
              <ChevronRight size={18} className="text-muted shrink-0" />
            </button>
          ))
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
