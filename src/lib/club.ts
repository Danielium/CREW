/**
 * Club field rules, shared by the create form, the club editor and the API
 * routes. Kept in one place because the client limits are only a convenience:
 * the routes have to enforce the same numbers for a request that skips the form.
 */

export const MAX_NAME = 20;
export const MAX_DESCRIPTION = 500;
export const MAX_TAGS = 3;
export const MAX_TAG_LENGTH = 16;

export const AVAILABLE_TAGS = [
  "Без напряга", "Хардкор", "Для новичков", "С собаками",
  "Стадион", "Трейл", "Утренние", "Совы", "Бег и пиво",
];

export const JOIN_TYPES = ["OPEN", "APPLICATION", "INVITE_ONLY"] as const;

/** Wording matches the join-type picker, so a club reads the same everywhere. */
export const JOIN_TYPE_LABELS: Record<string, string> = {
  OPEN: "Открытый",
  APPLICATION: "По заявкам",
  INVITE_ONLY: "Закрытый",
};

/**
 * Trims, truncates and de-duplicates tags case-insensitively, then caps the
 * count. Total silence on bad input is deliberate: tags are decorative, so a
 * junk entry is worth dropping rather than failing the whole write.
 */
export function sanitizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const tag = raw.trim().slice(0, MAX_TAG_LENGTH);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length === MAX_TAGS) break;
  }
  return tags;
}
