"use client";

import React from "react";
import Image from "next/image";
import { Users } from "lucide-react";

interface AvatarProgressProps {
  user: {
    name?: string | null;
    image?: string | null;
    totalDistance?: number;
    weeklyDistance?: number;
    weeklyGoal?: number;
  };
  size?: number; // Size in pixels
  strokeWidth?: number; // Thickness of the ring
  className?: string;
  onClick?: () => void;
}

export const getRankGradient = (distance: number) => {
  if (distance >= 15000) return { id: "grad-darkmatter", start: "#1E1B4B", end: "#000000" }; // Deep space / dark indigo to black
  if (distance >= 5000) return { id: "grad-gold", start: "#FDE047", end: "#B45309" }; // Bright gold to deep bronze
  if (distance >= 2500) return { id: "grad-silver", start: "#F1F5F9", end: "#475569" }; // Bright silver to dark steel
  if (distance >= 1000) return { id: "grad-ice", start: "#93C5FD", end: "#1D4ED8" }; // Light ice blue to deep blue
  if (distance >= 250) return { id: "grad-cyan", start: "#67E8F9", end: "#0E7490" }; // Bright cyan to deep teal
  if (distance >= 50) return { id: "grad-white", start: "#FFFFFF", end: "#9CA3AF" }; // Pure white to gray
  return { id: "grad-neon", start: "#CCFF00", end: "#84A300" }; // Bright neon to darker neon
};

export default function AvatarProgress({
  user,
  size = 112, // Default w-28 h-28 (112px)
  strokeWidth = 6,
  className = "",
  onClick
}: AvatarProgressProps) {
  // Gracefully handle missing data for private profiles or loading states
  const totalDistance = user.totalDistance || 0;
  const weeklyDistance = user.weeklyDistance || 0;
  const weeklyGoal = user.weeklyGoal || 15;

  const gradient = getRankGradient(totalDistance);
  const progressPercent = Math.min(100, Math.max(0, (weeklyDistance / weeklyGoal) * 100));

  const center = size / 2;
  const radius = center - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progressPercent / 100) * circumference;

  const isImage = user.image && (user.image.startsWith('http') || user.image.startsWith('data:') || user.image.startsWith('blob:') || user.image.startsWith('/uploads'));

  return (
    <div 
      className={`relative inline-flex items-center justify-center ${onClick ? 'cursor-pointer hover:opacity-90 active:scale-95 transition-all' : ''} ${className}`}
      style={{ width: size, height: size }}
      onClick={onClick}
    >
      {/* Background SVG for the ring track */}
      <svg className="absolute inset-0 w-full h-full transform -rotate-90" width={size} height={size}>
        <defs>
          <linearGradient id={gradient.id} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradient.start} />
            <stop offset="100%" stopColor={gradient.end} />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)" // Dark translucent track
          strokeWidth={strokeWidth}
        />
        {/* Progress Ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`url(#${gradient.id})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>

      {/* Avatar Container */}
      <div 
        className="relative bg-card rounded-full overflow-hidden flex items-center justify-center"
        style={{ 
          width: size - strokeWidth * 2 - 8, // Leave a small gap between ring and image
          height: size - strokeWidth * 2 - 8
        }}
      >
        {isImage ? (
          <img src={user.image!} alt={user.name || "User"} className="w-full h-full object-cover" />
        ) : (
          user.name ? (
            <span className="font-bold uppercase text-2xl">{user.name[0]}</span>
          ) : (
            <Users className="text-muted" size={size / 3} />
          )
        )}
      </div>
    </div>
  );
}
