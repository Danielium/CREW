/* Spinner — маленький инлайн-индикатор для кнопок/действий (сохранить, опубликовать,
   вступить): три точки на диагонали лого CREW, пульсируют по очереди, как шаг на бегу.
   Skeleton-компоненты — для загрузки страниц и списков: серые блоки в форме будущего
   контента (Facebook-style skeleton screen) вместо спиннера на пустом экране, чтобы
   макет не "прыгал" в момент, когда данные приходят. */

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

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`crew-skeleton rounded-xl ${className}`} />;
}

function SkeletonRow({ avatarShape = "circle" }: { avatarShape?: "circle" | "square" }) {
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
        <SkeletonRow key={i} avatarShape={avatarShape} />
      ))}
    </div>
  );
}

export function SkeletonEventCard() {
  return (
    <div className="w-full rounded-[28px] bg-[#1a1a1c] border border-border overflow-hidden flex flex-col" role="status" aria-label="Загрузка">
      <Skeleton className="w-full h-[260px] rounded-none" />
      <div className="p-5 flex flex-col gap-6">
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}

/* Полноэкранные лоадеры: форма экрана известна заранее (шапка/аватар/баннер),
   поэтому вместо спиннера в пустоте сразу показываем скелет будущей страницы. */
export function SkeletonScreen({
  variant = "list",
  className = "min-h-screen",
}: {
  variant?: "profile" | "hero" | "list";
  className?: string;
}) {
  return (
    <div className={`${className} bg-background pt-safe pb-24 flex flex-col`} role="status" aria-label="Загрузка">
      {variant === "profile" && (
        <div className="px-4 mb-6">
          <div className="flex justify-end mb-2">
            <Skeleton className="w-10 h-10 rounded-full" />
          </div>
          <div className="flex flex-col items-center mt-2 gap-4">
            <Skeleton className="w-[112px] h-[112px] rounded-full" />
            <Skeleton className="h-5 w-40" />
          </div>
        </div>
      )}

      {variant === "hero" && (
        <Skeleton className="h-64 w-full rounded-none mb-6" />
      )}

      {variant === "list" && (
        <div className="flex items-center gap-4 px-4 pb-4">
          <Skeleton className="h-7 w-40" />
        </div>
      )}

      <div className="flex flex-col gap-4 px-4">
        {variant !== "list" && (
          <div className="grid grid-cols-2 gap-3 mb-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}
        <SkeletonRows count={variant === "hero" ? 2 : 3} />
      </div>
    </div>
  );
}
