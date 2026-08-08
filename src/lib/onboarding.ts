// One-time contextual hints, one per tab. Each hint owns a bit in
// User.onboardingSeenMask, so a user sees each tab's hint exactly once ever and
// the four are independent (visiting /feed first must not burn the map hint).

export type OnboardingStepId = "map" | "feed" | "club" | "profile";

export type OnboardingStep = {
  id: OnboardingStepId;
  bit: number;
  /** Pathname that must match for this hint to be eligible. */
  match: (pathname: string) => boolean;
  /** `data-onboarding` value of the element to spotlight. Absent = unanchored card. */
  anchor?: string;
  /** Corner radius of the anchor, so the cutout traces it instead of boxing it. */
  anchorRadius?: number;
  title: string;
  body: string;
};

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "map",
    bit: 1,
    match: (p) => p === "/",
    title: "Найди, с кем бежать",
    body: "Нажми на карту, чтобы поставить свой маячок. Нажми на чужой — и попросись в компанию.",
  },
  {
    id: "feed",
    bit: 2,
    match: (p) => p === "/feed",
    anchor: "feed-composer",
    anchorRadius: 22,
    title: "Расскажи, как пробежал",
    body: "Пара слов, фото или видео с тренировки. Лента — то, ради чего сюда возвращаются.",
  },
  {
    id: "club",
    bit: 4,
    match: (p) => p === "/club",
    anchor: "club-create",
    anchorRadius: 28,
    title: "Клуб — это командный зачёт",
    body: "Создай свой или вступи в открытый из списка ниже. Километры всех участников идут в общий рейтинг.",
  },
  {
    id: "profile",
    bit: 8,
    match: (p) => p === "/profile",
    anchor: "profile-settings",
    anchorRadius: 999,
    title: "Подключи Strava",
    body: "Пробежки подтянутся сами — статистика, график и история. Без Strava здесь будет пусто.",
  },
];

/** Highest-priority hint for this screen that the user has not seen yet. */
export function pickStep(pathname: string, seenMask: number): OnboardingStep | null {
  return ONBOARDING_STEPS.find((s) => s.match(pathname) && (seenMask & s.bit) === 0) ?? null;
}
