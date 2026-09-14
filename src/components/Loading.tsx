import type { CSSProperties } from "react";

/* Spinner — маленький инлайн-индикатор для кнопок/действий (сохранить, опубликовать,
   вступить): три точки на диагонали лого CREW, пульсируют по очереди, как шаг на бегу.
   Skeleton-компоненты — для загрузки страниц и списков: серые блоки повторяют форму
   и размеры конкретного экрана (не общий плейсхолдер), чтобы макет не "прыгал" в
   момент, когда приходят настоящие данные. Каждый skeleton-компонент здесь — почти
   буквальный слепок разметки своего экрана (те же классы обёрток, те же размеры),
   так что если экран поменяет вёрстку, его skeleton тоже надо будет поправить. */

export function Spinner({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 ${className}`}
      role="status"
      aria-label="Загрузка"
    >
      <circle className="crew-spinner-dot" cx="6" cy="18" r="2.1" fill="currentColor" />
      <circle className="crew-spinner-dot" cx="12" cy="12" r="2.1" fill="currentColor" />
      <circle className="crew-spinner-dot" cx="18" cy="6" r="2.1" fill="currentColor" />
    </svg>
  );
}

export function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
  // Rounded-* и rounded-xl (дефолт ниже) — утилиты одного класса специфичности:
  // если бы обе стояли в атрибуте одновременно, чья победит решал бы порядок
  // в сгенерированном Tailwind-стиле, а не порядок в className. Поэтому дефолт
  // подключается только когда явного rounded-* нет вовсе.
  const hasRadius = /(^|\s)rounded(-|\s|$)/.test(className);
  return <div className={`crew-skeleton ${hasRadius ? "" : "rounded-xl"} ${className}`} style={style} />;
}

/* ── Списки: лента, клубы, рейтинг, заявки, каталог целей ──────────────── */

function GenericRow({ avatarShape = "circle" }: { avatarShape?: "circle" | "square" }) {
  return (
    <div className="flex items-center gap-3.5 p-4 bg-card/40 backdrop-blur-md border border-white/5 rounded-[22px]">
      <Skeleton className={avatarShape === "circle" ? "w-10 h-10 rounded-full shrink-0" : "w-14 h-14 rounded-2xl shrink-0"} />
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-2.5 w-full" />
        <Skeleton className="h-2.5 w-3/5" />
      </div>
    </div>
  );
}

export function SkeletonRows({ count = 4, avatarShape = "circle", className = "" }: { count?: number; avatarShape?: "circle" | "square"; className?: string }) {
  return (
    <div className={`flex flex-col gap-3 ${className}`} role="status" aria-label="Загрузка">
      {Array.from({ length: count }).map((_, i) => (
        <GenericRow key={i} avatarShape={avatarShape} />
      ))}
    </div>
  );
}

/* Пост в ленте: аватар 40px + имя/время + 2 строки текста + панель реакций (feed/page.tsx). */
export function FeedPostSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Загрузка">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 bg-card/40 backdrop-blur-md border border-white/5 rounded-[22px]">
          <div className="flex gap-3">
            <Skeleton className="w-10 h-10 rounded-full shrink-0" />
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <div className="flex items-center gap-2 mt-2">
                <Skeleton className="h-7 w-14 rounded-full" />
                <Skeleton className="h-7 w-14 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* Строка клуба в общем рейтинге: ранг + бейдж 44px + имя/метки + km справа (GlobalClubs.tsx). */
export function ClubRowsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Загрузка">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card/40 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="w-[22px] h-5 rounded-md shrink-0" />
            <Skeleton className="w-11 h-11 rounded-full shrink-0" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          </div>
          <Skeleton className="h-6 w-12" />
        </div>
      ))}
    </div>
  );
}

/* Строка рейтинга атлетов: ранг + аватар 40px + имя + дистанция справа (Leaderboard.tsx). */
export function LeaderboardRowsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-label="Загрузка">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-3.5 rounded-[16px] bg-card border border-border">
          <div className="flex items-center gap-4">
            <Skeleton className="w-4 h-5 rounded-md shrink-0" />
            <Skeleton className="w-10 h-10 rounded-full shrink-0" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <Skeleton className="h-5 w-14" />
        </div>
      ))}
    </div>
  );
}

/* Входящая заявка на пробежку: аватар 48 + имя/статы + 2 круглые кнопки,
   плитка времени, ряд из двух кнопок (map/requests/page.tsx). */
export function RequestCardsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Загрузка">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-full shrink-0" />
            <div className="flex-1 flex flex-col gap-2">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-2.5 w-20" />
            </div>
            <Skeleton className="w-12 h-12 rounded-full shrink-0" />
            <Skeleton className="w-12 h-12 rounded-full shrink-0" />
          </div>
          <Skeleton className="h-11 w-full rounded-xl" />
          <div className="flex gap-2">
            <Skeleton className="h-11 flex-1 rounded-xl" />
            <Skeleton className="h-11 flex-1 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* Карточка события в ленте клуба: превью 260px + бейдж/заголовок поверх низа
   картинки + 2 колонки статов внизу (FeedEvents.tsx). */
export function SkeletonEventCard() {
  return (
    <div className="w-full rounded-[28px] bg-[#1a1a1c] border border-border overflow-hidden flex flex-col" role="status" aria-label="Загрузка">
      <div className="relative w-full h-[260px]">
        <Skeleton className="absolute inset-0 rounded-none" />
        <div className="absolute inset-0 p-5 flex flex-col justify-end gap-3">
          <Skeleton className="h-5 w-24 rounded-full bg-black/40" />
          <Skeleton className="h-7 w-2/3 bg-black/40" />
          <Skeleton className="h-3.5 w-1/2 bg-black/40" />
        </div>
      </div>
      <div className="grid grid-cols-2 divide-x divide-white/10 py-5">
        <div className="flex flex-col gap-2 pl-6 sm:pl-10">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-2.5 w-16" />
        </div>
        <div className="flex flex-col gap-2 pl-6 sm:pl-10">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-2.5 w-16" />
        </div>
      </div>
    </div>
  );
}

/* ── Полноэкранные загрузки: форма экрана известна заранее ──────────────── */

/* Профиль / чужой профиль: аватар 112px по центру, имя, сегмент-контрол,
   огромная цифра дистанции, 3 статы, бар-чарт, карточки пробежек
   (profile/page.tsx, users/[id]/page.tsx — вёрстка идентична). */
export function ProfileSkeleton({ showSettings = true }: { showSettings?: boolean }) {
  return (
    <div className="flex flex-col min-h-[100dvh] pt-safe pb-24" role="status" aria-label="Загрузка">
      <div className="px-4 mb-6 relative">
        {showSettings && (
          <div className="absolute top-0 right-4">
            <Skeleton className="w-10 h-10 rounded-full" />
          </div>
        )}
        <div className="flex flex-col items-center mt-4 gap-4">
          <Skeleton className="w-[112px] h-[112px] rounded-full" />
          <Skeleton className="h-6 w-44" />
        </div>
      </div>

      <div className="flex flex-col gap-6 px-4">
        <Skeleton className="h-11 w-full max-w-[320px] mx-auto rounded-full" />

        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-[64px] w-40" />
          <Skeleton className="h-2.5 w-20 mb-2" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>

        <div className="flex items-end justify-between gap-1 h-40 pb-6">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="flex-1 rounded-t-sm rounded-b-none" style={{ height: `${20 + (i % 4) * 18}%` }} />
          ))}
        </div>

        <div className="flex flex-col gap-4 mt-2">
          <Skeleton className="h-6 w-52" />
          <div className="bg-card/40 backdrop-blur-md border border-white/5 rounded-[24px] p-5 flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-2.5 w-20" />
              </div>
            </div>
          </div>
          <div className="bg-card/40 backdrop-blur-md border border-white/5 rounded-[24px] p-5 flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-2.5 w-20" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Страница клуба: баннер-шапка 256px (тег-плашки, бейдж 64px, имя),
   2 карточки-статы, блок описания (club/[id]/page.tsx). */
export function ClubDetailSkeleton() {
  return (
    <div className="min-h-[100dvh] flex flex-col" role="status" aria-label="Загрузка">
      <div className="h-64 bg-card/40 backdrop-blur-xl relative flex flex-col justify-end p-6 border-b border-white/5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <Skeleton className="h-5 w-28 rounded-md" />
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="w-16 h-16 rounded-full shrink-0" />
          <Skeleton className="h-8 w-40" />
        </div>
      </div>

      <div className="p-6 flex flex-col gap-8 pb-24">
        <div className="flex gap-4">
          <Skeleton className="flex-1 h-[86px] rounded-3xl" />
          <Skeleton className="flex-1 h-[86px] rounded-3xl" />
        </div>

        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>

        <Skeleton className="h-[220px] w-full rounded-3xl" />
      </div>
    </div>
  );
}

/* Страница события: превью 256px с заголовком/датой поверх низа картинки,
   локация, описание, список участников (events/[id]/page.tsx). */
export function EventDetailSkeleton() {
  return (
    <div className="min-h-screen pb-20" role="status" aria-label="Загрузка">
      <div className="relative h-64 w-full">
        <Skeleton className="absolute inset-0 rounded-none" />
        <div className="absolute bottom-0 left-0 w-full p-6 flex flex-col gap-3">
          <Skeleton className="h-7 w-2/3 bg-black/40" />
          <Skeleton className="h-3.5 w-1/2 bg-black/40" />
        </div>
      </div>

      <div className="p-6">
        <div className="mb-10 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>

        <Skeleton className="h-6 w-48 mb-4" />
        <SkeletonRows count={3} />
      </div>
    </div>
  );
}

/* Поле формы: подпись капсом + прямоугольник инпута (общий язык всех форм
   в приложении, см. text-[10px] font-bold text-muted uppercase в CLAUDE.md). */
function SkeletonField({ height = "h-[52px]" }: { height?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-2.5 w-32 rounded-full" />
      <Skeleton className={`${height} w-full rounded-2xl`} />
    </div>
  );
}

/* Форма редактирования события: заголовок, название, описание, обложка,
   точка сбора, дата/время, кнопка сохранить (events/[id]/edit/page.tsx). */
export function EventFormSkeleton() {
  return (
    <div className="min-h-[100dvh] flex flex-col" role="status" aria-label="Загрузка">
      <div className="flex items-center gap-4 px-4 pb-4 pt-safe border-b border-border">
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="p-4 flex flex-col gap-6 max-w-md mx-auto w-full mt-4">
        <SkeletonField />
        <SkeletonField height="h-20" />
        <SkeletonField height="h-48" />
        <SkeletonField />
        <SkeletonField />
        <Skeleton className="h-14 w-full rounded-2xl mt-2" />
      </div>
    </div>
  );
}

/* Форма входа: заголовок в 2 строки, 2 инпута, кнопка (login/page.tsx). */
export function LoginSkeleton() {
  return (
    <div className="flex flex-col min-h-[100dvh] pt-safe pb-8 px-6" role="status" aria-label="Загрузка">
      <div className="flex-1 flex flex-col justify-center gap-8 -mt-16">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-9 w-1/2" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-[56px] w-full rounded-[20px]" />
          <Skeleton className="h-[56px] w-full rounded-[20px]" />
          <Skeleton className="h-[56px] w-full rounded-[20px] mt-2" />
        </div>
      </div>
    </div>
  );
}

/* Вкладка "Клуб": карточка моего клуба/CTA, табы, список ниже (club/page.tsx). */
export function ClubListSkeleton() {
  return (
    <div className="flex flex-col min-h-[100dvh] pb-24 pt-safe" role="status" aria-label="Загрузка">
      <div className="px-4 mb-4 mt-4">
        <div className="bg-card/40 backdrop-blur-xl border border-white/5 rounded-[28px] p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          </div>
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
        </div>
      </div>

      <div className="flex px-4 mt-2 gap-6 pb-3">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-3.5 w-16" />
      </div>

      <div className="px-4 mt-4">
        <ClubRowsSkeleton count={4} />
      </div>
    </div>
  );
}

/* Вкладка "Цели": заголовок, активная цель (шапка + трек-полоса), каталог (challenges/page.tsx). */
export function ChallengesSkeleton() {
  return (
    <div className="flex flex-col min-h-[100dvh] pb-28 pt-safe" role="status" aria-label="Загрузка">
      <Skeleton className="h-8 w-32 mx-4 mt-2 mb-4" />

      <div className="mx-4 bg-card/40 backdrop-blur-md border border-white/5 rounded-[22px] overflow-hidden p-5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-11 h-11 rounded-full shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        </div>
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>

      <Skeleton className="h-5 w-40 mx-4 mt-8 mb-3" />
      <div className="px-4">
        <SkeletonRows count={3} />
      </div>
    </div>
  );
}
