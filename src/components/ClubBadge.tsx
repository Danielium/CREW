"use client";
import React from "react";
import { Zap, Flame, Skull, Sword, Shield, Mountain, Anchor, Crown, Star, Heart, Activity, Target, Trophy, Ghost, Crosshair, HelpCircle } from "lucide-react";

export type ShapeType = "square" | "circle" | "triangle" | "octagon";
export type PatternType = "solid" | "split-diagonal" | "stripes" | "checker" | "half-vertical";

interface ClubBadgeProps {
  size?: number;
  shape?: ShapeType;
  pattern?: PatternType;
  color1?: string;
  color2?: string;
  iconName?: string;
  iconColor?: string;
  imageUrl?: string;
  className?: string;
}

const ICON_MAP: Record<string, any> = {
  Zap, Flame, Skull, Sword, Shield, Mountain, Anchor, Crown, Star, Heart, Activity, Target, Trophy, Ghost, Crosshair
};

export default function ClubBadge({
  size = 64,
  shape = "circle",
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

  // Define SVG clip path based on shape
  let clipPath = "";
  if (shape === "circle") {
    clipPath = "circle(50% at 50% 50%)";
  } else if (shape === "triangle") {
    clipPath = "polygon(50% 0%, 0% 100%, 100% 100%)";
  } else if (shape === "octagon") {
    clipPath = "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)";
  } else {
    // rounded square by default
    clipPath = "inset(0% round 15%)";
  }

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

  // Adjust icon size and position specifically for triangle so it doesn't spill out
  const iconSize = shape === "triangle" ? size * 0.4 : size * 0.55;
  const iconMarginTop = shape === "triangle" ? size * 0.25 : 0;

  return (
    <div 
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {imageUrl ? (
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ clipPath, backgroundImage: `url(${imageUrl})` }}
        />
      ) : (
        <>
          <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ clipPath }}>
            <defs>{renderPattern()}</defs>
            <rect x="0" y="0" width="100" height="100" fill={fill} />
          </svg>
          
          <div className="absolute inset-0 flex items-center justify-center drop-shadow-md" style={{ marginTop: iconMarginTop }}>
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
