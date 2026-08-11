"use client";

import { useState, useEffect } from "react";
import { Flag, Users, Shield, Lock, ClipboardCheck, Loader2, Check, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ClubLogoPicker, { DEFAULT_SIMPLE_LOGO, type SimpleLogoConfig } from "@/components/ClubLogoPicker";
import ClubBadge from "@/components/ClubBadge";
import TagPicker from "@/components/TagPicker";
import { globalCache } from "@/lib/cache";
import { MAX_NAME, MAX_TAGS, JOIN_TYPE_LABELS } from "@/lib/club";

const JOIN_TYPES = [
  { value: "OPEN", icon: Users, title: JOIN_TYPE_LABELS.OPEN, desc: "Любой желающий может вступить в один клик." },
  { value: "APPLICATION", icon: ClipboardCheck, title: JOIN_TYPE_LABELS.APPLICATION, desc: "Вы свайпаете кандидатов. Элитарный клуб." },
  { value: "INVITE_ONLY", icon: Lock, title: JOIN_TYPE_LABELS.INVITE_ONLY, desc: "Только по секретной ссылке-инвайту." },
];

// Punchy heading, functional subtitle — same pairing the club tab uses for
// "Создать клуб / Собери свою беговую банду".
const STEPS = [
  { title: "Лицо клуба", hint: "Эмблема, название и описание" },
  { title: "Кто в деле", hint: "Как вступают и какой у вас вайб" },
  { title: "Всё верно?", hint: "Так клуб увидят другие бегуны" },
];

const LABEL = "text-[10px] font-bold text-muted uppercase tracking-widest";

export default function CreateClubPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [joinType, setJoinType] = useState("OPEN");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [logoConfig, setLogoConfig] = useState<SimpleLogoConfig>(DEFAULT_SIMPLE_LOGO);

  // Each step is its own screen: without this the next step opens already
  // scrolled to wherever the previous one was left.
  useEffect(() => {
    document.getElementById("main-scroll-container")?.scrollTo({ top: 0 });
  }, [step]);

  // Steps are component state, not routes, but Telegram's back button (and
  // Android's) only knows history. Advancing pushes a same-URL entry so back
  // walks the steps instead of dropping the whole half-filled form; from the
  // first step it pops the real entry and leaves, which is what back should do.
  useEffect(() => {
    const onPopState = () => setStep(current => Math.max(0, current - 1));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: desc,
          joinType,
          tags: selectedTags,
          logoConfig,
        }),
      });
      const data = await res.json();
      if (data.club) {
        globalCache.clubs = null;
        globalCache.userData = null;
        // replace, not push: the club exists now, so back should not walk into
        // the form that created it.
        router.replace("/club");
      } else {
        alert(data.error || "Ошибка при создании клуба");
        setIsLoading(false);
      }
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  };

  if (!session) return <div className="p-8 text-center text-muted">Необходимо войти в систему</div>;

  // Only the name gates progress; everything else has a workable default, so a
  // founder is never blocked by a decision they have not formed an opinion on.
  const canAdvance = step !== 0 || name.trim().length > 0;
  const isLastStep = step === STEPS.length - 1;
  const joinTypeLabel = JOIN_TYPES.find(t => t.value === joinType)?.title ?? joinType;

  const goNext = () => {
    if (!canAdvance) return;
    if (isLastStep) {
      handleCreate();
      return;
    }
    // Same URL, new entry: gives the back button something to pop per step.
    window.history.pushState(null, "");
    setStep(step + 1);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground pb-12 relative z-10">
      {/* Dynamic Background Glow */}
      <div className="fixed top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-primary/10 to-transparent -z-10 pointer-events-none" />
      <div className="fixed top-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-primary/20 rounded-full blur-[100px] -z-10 pointer-events-none opacity-50" />

      <div className="sticky top-0 z-50 bg-background/60 backdrop-blur-xl pt-safe pb-4 px-4 border-b border-white/5">
        <h1 className="text-2xl font-bold uppercase tracking-normal drop-shadow-sm font-display">Создать Клуб</h1>

        {/* Progress: one segment per step, so the end of the flow is always in sight. */}
        <div className="flex gap-1.5 mt-3" role="presentation">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= step ? "bg-primary" : "bg-white/10"}`}
            />
          ))}
        </div>
      </div>

      <div key={step} className="px-6 py-6 flex flex-col gap-6 flex-1 relative z-10 animate-in fade-in slide-in-from-right-6 duration-300">

        <div>
          <h2 className="text-xl font-bold uppercase tracking-normal font-display">{STEPS[step].title}</h2>
          <p className="text-sm text-muted leading-relaxed mt-1">{STEPS[step].hint}</p>
        </div>

        {step === 0 && (
          <>
            <div className="flex flex-col items-center py-6 px-5 bg-card/40 backdrop-blur-xl border border-white/5 rounded-[28px] relative overflow-hidden group shadow-xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[50px] -z-10 group-hover:bg-primary/20 transition-all duration-500" />
              <ClubLogoPicker value={logoConfig} onChange={setLogoConfig} />
            </div>

            <div className="flex flex-col gap-4 bg-card/40 backdrop-blur-xl border border-white/5 rounded-[28px] p-6 shadow-xl">
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <label htmlFor="club-name" className={LABEL}>Название клуба</label>
                  {/* Stays out of the way until the 20-char cap is actually near,
                      which used to be discoverable only by hitting it. */}
                  {name.length > MAX_NAME - 5 && (
                    <span className={`text-[10px] font-bold tabular-nums ${name.length === MAX_NAME ? "text-primary" : "text-muted"}`}>
                      {MAX_NAME - name.length}
                    </span>
                  )}
                </div>
                <input
                  id="club-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={MAX_NAME}
                  className="w-full bg-black/40 border border-white/5 rounded-2xl px-4 py-4 text-foreground text-lg focus:outline-none focus:border-primary/50 transition-colors font-bold uppercase tracking-wide font-display"
                  placeholder="Введите название"
                />
              </div>
              <div>
                <label htmlFor="club-desc" className={`${LABEL} mb-2 block`}>Описание клуба</label>
                <textarea
                  id="club-desc"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full bg-card border border-border rounded-2xl px-4 py-3 text-foreground focus:outline-none focus:border-primary transition-colors text-sm min-h-[100px] resize-none"
                  placeholder="Расскажите о клубе: где и как часто вы бегаете, кого ждете в команду"
                />
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div>
              <label className={`${LABEL} mb-3 flex items-center gap-2`}><Shield size={14}/> Эксклюзивность</label>
              <div className="flex flex-col gap-2">
                {JOIN_TYPES.map(({ value, icon: Icon, title, desc: optionDesc }) => {
                  const isSelected = joinType === value;
                  return (
                    <button
                      key={value}
                      onClick={() => setJoinType(value)}
                      aria-pressed={isSelected}
                      className={`flex items-start gap-3 p-4 rounded-2xl border transition-all text-left ${isSelected ? "bg-primary/10 border-primary" : "bg-card border-border"}`}
                    >
                      <Icon size={20} className={isSelected ? "text-primary" : "text-muted"} />
                      <div>
                        <h3 className="font-bold text-sm uppercase">{title}</h3>
                        <p className="text-xs text-muted mt-1">{optionDesc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className={`${LABEL} mb-3 flex items-center gap-2`}><Flag size={14}/> Вайб (до {MAX_TAGS} тегов)</label>
              <TagPicker value={selectedTags} onChange={setSelectedTags} />
            </div>
          </>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            {/* Mirrors the club row in "Битва Клубов" so the preview is truthful. */}
            <div className="bg-card/40 backdrop-blur-xl border border-white/5 rounded-[28px] p-6 shadow-xl flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[50px] -z-10" />
              <ClubBadge {...logoConfig} size={72} />
              <h3 className="font-bold uppercase tracking-normal font-display text-2xl mt-4 break-words max-w-full">{name}</h3>
              {desc.trim() && <p className="text-sm text-muted leading-relaxed mt-2 whitespace-pre-wrap">{desc}</p>}
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary/70 px-3 py-1 bg-primary/10 rounded-full">{joinTypeLabel}</span>
                {selectedTags.map(tag => (
                  <span key={tag} className="text-[10px] font-bold uppercase tracking-widest text-muted px-3 py-1 bg-white/5 rounded-full">{tag}</span>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted leading-relaxed text-center px-4">
              Всё это можно поменять позже на странице клуба.
            </p>
          </div>
        )}

      </div>

      <div className="px-6 mt-2">
        <button
          onClick={goNext}
          disabled={isLoading || !canAdvance}
          className="w-full py-4 rounded-2xl bg-primary text-black font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-[#b3e600] active:scale-[0.98] transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(204,255,0,0.3)]"
        >
          {isLoading
            ? <Loader2 className="animate-spin" size={20} />
            : isLastStep
              ? <><Check size={20} /> Зарегистрировать</>
              : <>Далее <ArrowRight size={20} /></>}
        </button>
        {step === 0 && !canAdvance && (
          <p className="text-xs text-muted text-center mt-3">Введите название, чтобы продолжить</p>
        )}
      </div>

    </div>
  );
}
