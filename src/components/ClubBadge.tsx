"use client";
import React from "react";
import { Zap, Flame, Skull, Sword, Shield, Mountain, Anchor, Crown, Star, Heart, Activity, Target, Trophy, Ghost, Crosshair, Flag, HelpCircle } from "lucide-react";

export type PatternType = "solid" | "split-diagonal" | "stripes" | "checker" | "half-vertical";

interface ClubBadgeProps {
  size?: number;
  pattern?: PatternType;
  color1?: string;
  color2?: string;
  iconName?: string;
  iconColor?: string;
  imageUrl?: string;
  className?: string;
}

const ICON_MAP: Record<string, any> = {
  Zap, Flame, Skull, Sword, Shield, Mountain, Anchor, Crown, Star, Heart, Activity, Target, Trophy, Ghost, Crosshair, Flag
};

/** The one and only club logo silhouette — a rounded square. */
export const BADGE_CLIP_PATH = "inset(0% round 24%)";

/**
 * Reads the `logoConfig` column. Legacy rows may still carry a `shape` field from
 * the removed emblem constructor — it is stripped here so nothing can resurrect
 * circles/triangles/octagons. Returns null when there is nothing to render.
 */
export function parseClubLogo(raw?: string | null): Record<string, any> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const { shape: _legacyShape, ...rest } = parsed as Record<string, any>;
    return Object.keys(rest).length > 0 ? rest : null;
  } catch {
    return null;
  }
}

export default function ClubBadge({
  size = 64,
  pattern = "solid",
  color1 = "#FFFFFF",
  color2 = "#111111",
  iconName = "Zap",
  iconColor = "#000000",
  imageUrl,
  className = "",
}: ClubBadgeProps) {
  // Get icon component dynamically from map
  const IconComponent = ICON_MAP[iconName] || HelpCircle;

  // Render SVG pattern defs
  const renderPattern = () => {
    switch (pattern) {
      case "split-diagonal":
        return (
          <linearGradient id={`pattern-${pattern}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="50%" stopColor={color1} />
            <stop offset="50%" stopColor={color2} />
          </linearGradient>
        );
      case "half-vertical":
        return (
          <linearGradient id={`pattern-${pattern}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="50%" stopColor={color1} />
            <stop offset="50%" stopColor={color2} />
          </linearGradient>
        );
      case "stripes":
        return (
          <pattern id={`pattern-${pattern}`} width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="20" height="20" fill={color1} />
            <rect width="10" height="20" fill={color2} />
          </pattern>
        );
      case "checker":
        return (
          <pattern id={`pattern-${pattern}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill={color1} />
            <rect x="0" y="0" width="10" height="10" fill={color2} />
            <rect x="10" y="10" width="10" height="10" fill={color2} />
          </pattern>
        );
      case "solid":
      default:
        return null;
    }
  };

  const fill = pattern === "solid" ? color1 : `url(#pattern-${pattern})`;
  const iconSize = size * 0.55;

  return (
    <div 
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {imageUrl ? (
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ clipPath: BADGE_CLIP_PATH, backgroundImage: `url(${imageUrl})` }}
        />
      ) : (
        <>
          <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ clipPath: BADGE_CLIP_PATH }}>
            <defs>{renderPattern()}</defs>
            <rect x="0" y="0" width="100" height="100" fill={fill} />
          </svg>
          
          <div className="absolute inset-0 flex items-center justify-center drop-shadow-md">
            <IconComponent 
              size={iconSize} 
              color={iconColor} 
              strokeWidth={2.5} 
            />
          </div>
        </>
      )}
    </div>
  );
}
