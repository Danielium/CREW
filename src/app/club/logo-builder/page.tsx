"use client";
import React, { useState, useEffect } from "react";
import { ArrowLeft, Check, Zap, Flame, Skull, Sword, Shield, Mountain, Anchor, Crown, Star, Heart, Activity, Target, Trophy, Ghost, Crosshair, HelpCircle } from "lucide-react";
import ClubBadge, { ShapeType, PatternType } from "@/components/ClubBadge";

const SHAPES: { id: ShapeType; name: string }[] = [
  { id: "square", name: "Квадрат" },
  { id: "hexagon", name: "Гексагон" },
  { id: "circle", name: "Круг" },
  { id: "octagon", name: "Октагон" },
];

const PATTERNS: { id: PatternType; name: string }[] = [
  { id: "solid", name: "Сплошной" },
  { id: "split-diagonal", name: "Диагональ" },
  { id: "half-vertical", name: "Половина" },
  { id: "stripes", name: "Полосы" },
  { id: "checker", name: "Шашки" },
];

const COLORS = [
  "#CCFF00", // Acid Green
  "#FF3366", // Cyber Pink
  "#00E5FF", // Electric Blue
  "#FF6B00", // Bright Orange
  "#8A2BE2", // Purple
  "#FFFFFF", // White
  "#111111", // Pitch Black
  "#8E8E93", // Gray
];

const ICON_MAP: Record<string, any> = {
  Zap, Flame, Skull, Sword, Shield, Mountain, Anchor, Crown, Star, Heart, Activity, Target, Trophy, Ghost, Crosshair
};

const ICONS = Object.keys(ICON_MAP);

export default function LogoBuilder() {
  const [shape, setShape] = useState<ShapeType>("hexagon");
  const [pattern, setPattern] = useState<PatternType>("solid");
  const [color1, setColor1] = useState(COLORS[0]);
  const [color2, setColor2] = useState(COLORS[6]);
  const [icon, setIcon] = useState("Zap");
  const [iconColor, setIconColor] = useState(COLORS[6]);

  const [activeTab, setActiveTab] = useState<"shape" | "pattern" | "color" | "icon">("shape");

  // Hide BottomNav on mount
  useEffect(() => {
    window.dispatchEvent(new Event("hideNav"));
    return () => {
      window.dispatchEvent(new Event("showNav"));
    };
  }, []);

  const handleSave = () => {
    const config = { shape, pattern, color1, color2, iconName: icon, iconColor };
    localStorage.setItem("clubLogoConfig", JSON.stringify(config));
    window.history.back();
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-background text-foreground z-50">
      
      {/* Header */}
      <div className="flex justify-between items-center px-4 pt-12 pb-4 bg-card border-b border-border">
        <button 
          onClick={() => window.history.back()}
          className="p-2 rounded-full hover:bg-border transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Эмблема клуба</h1>
        <button 
          onClick={handleSave}
          className="p-2 rounded-full text-primary hover:bg-border transition-colors"
        >
          <Check size={24} />
        </button>
      </div>

      {/* Preview Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-b from-card to-background border-b border-border">
        <ClubBadge 
          size={160} 
          shape={shape} 
          pattern={pattern} 
          color1={color1} 
          color2={color2} 
          iconName={icon} 
          iconColor={iconColor} 
          className="shadow-[0_20px_50px_rgba(0,0,0,0.3)] transition-all duration-300"
        />
      </div>

      {/* Controls Tabs */}
      <div className="flex border-b border-border">
        {[
          { id: "shape", label: "Форма" },
          { id: "pattern", label: "Узор" },
          { id: "color", label: "Цвета" },
          { id: "icon", label: "Иконка" },
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
              activeTab === tab.id ? "border-b-2 border-primary text-primary" : "text-muted"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Controls Area */}
      <div className="h-[280px] bg-card overflow-y-auto p-4 pb-8">
        
        {activeTab === "shape" && (
          <div className="grid grid-cols-2 gap-3">
            {SHAPES.map(s => (
              <button 
                key={s.id}
                onClick={() => setShape(s.id)}
                className={`p-4 rounded-xl border-2 flex items-center justify-center font-bold text-sm ${shape === s.id ? 'border-primary text-primary' : 'border-border text-muted'}`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        {activeTab === "pattern" && (
          <div className="grid grid-cols-2 gap-3">
            {PATTERNS.map(p => (
              <button 
                key={p.id}
                onClick={() => setPattern(p.id)}
                className={`p-4 rounded-xl border-2 flex items-center justify-center font-bold text-sm ${pattern === p.id ? 'border-primary text-primary' : 'border-border text-muted'}`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {activeTab === "color" && (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">Основной цвет</p>
              <div className="flex flex-wrap gap-3">
                {COLORS.map(c => (
                  <button 
                    key={`c1-${c}`}
                    onClick={() => setColor1(c)}
                    className={`w-10 h-10 rounded-full border-2 ${color1 === c ? 'border-foreground' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            {pattern !== "solid" && (
              <div>
                <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">Дополнительный цвет</p>
                <div className="flex flex-wrap gap-3">
                  {COLORS.map(c => (
                    <button 
                      key={`c2-${c}`}
                      onClick={() => setColor2(c)}
                      className={`w-10 h-10 rounded-full border-2 ${color2 === c ? 'border-foreground' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">Цвет эмблемы</p>
              <div className="flex flex-wrap gap-3">
                {COLORS.map(c => (
                  <button 
                    key={`c3-${c}`}
                    onClick={() => setIconColor(c)}
                    className={`w-10 h-10 rounded-full border-2 ${iconColor === c ? 'border-foreground' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "icon" && (
          <div className="grid grid-cols-5 gap-3">
            {ICONS.map(i => {
              // @ts-ignore
              const IconComp = ICON_MAP[i] || HelpCircle;
              return (
                <button 
                  key={i}
                  onClick={() => setIcon(i)}
                  className={`aspect-square rounded-xl flex items-center justify-center border-2 ${icon === i ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground hover:bg-border'}`}
                >
                  <IconComp size={24} />
                </button>
              );
            })}
          </div>
        )}

      </div>

    </div>
  );
}
