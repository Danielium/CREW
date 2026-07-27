"use client";
import { useRef, useState } from "react";

export type MediaKind = "image" | "video";
export type MediaItem = { url: string; type: MediaKind };

const VIDEO_EXT = /\.(mp4|webm|mov)(\?|$)/i;

/**
 * Media is persisted in the existing `mediaUrl` string column: legacy rows hold a
 * bare URL, new ones hold a JSON array. Keeping both shapes in one column avoids a
 * production migration while still supporting multiple attachments.
 */
export function parseMedia(raw: string | null | undefined): MediaItem[] {
  if (!raw) return [];
  const value = raw.trim();

  if (value.startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => item && typeof item.url === "string")
          .map((item) => ({
            url: item.url,
            type: item.type === "video" ? "video" : "image",
          }));
      }
    } catch {
      // fall through to single-url handling
    }
  }

  return [{ url: value, type: VIDEO_EXT.test(value) ? "video" : "image" }];
}

export function serializeMedia(items: MediaItem[]): string | null {
  if (items.length === 0) return null;
  if (items.length === 1 && items[0].type === "image") return items[0].url;
  return JSON.stringify(items);
}

export function MediaCarousel({ items }: { items: MediaItem[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  if (items.length === 0) return null;

  if (items.length === 1) {
    const item = items[0];
    return (
      <div className="rounded-2xl overflow-hidden bg-black/30">
        {item.type === "video" ? (
          <video
            src={item.url}
            controls
            playsInline
            preload="metadata"
            className="w-full max-h-[520px]"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <img src={item.url} alt="" className="w-full h-auto max-h-[520px] object-contain" />
        )}
      </div>
    );
  }

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const center = el.scrollLeft + el.clientWidth / 2;
    let nearest = 0;
    let nearestDistance = Infinity;
    Array.from(el.children).forEach((child, index) => {
      const node = child as HTMLElement;
      const distance = Math.abs(node.offsetLeft + node.offsetWidth / 2 - center);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = index;
      }
    });
    setActive(nearest);
  };

  return (
    <div>
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex gap-2 items-center overflow-x-auto snap-x snap-mandatory no-scrollbar"
      >
        {items.map((item, index) => (
          <div
            key={`${item.url}-${index}`}
            className="snap-center shrink-0 rounded-2xl overflow-hidden bg-black/30"
          >
            {/* Sized by max-height/max-width only, so landscape stays landscape
                instead of being cropped into a portrait tile. */}
            {item.type === "video" ? (
              <video
                src={item.url}
                controls
                playsInline
                preload="metadata"
                className="max-h-[380px] max-w-[78vw] w-auto h-auto"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <img src={item.url} alt="" className="max-h-[380px] max-w-[78vw] w-auto h-auto" />
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-center items-center gap-1.5 mt-2.5">
        {items.map((_, index) => (
          <span
            key={index}
            className={`h-1.5 rounded-full transition-all duration-200 ${
              index === active ? "w-4 bg-primary" : "w-1.5 bg-white/25"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
