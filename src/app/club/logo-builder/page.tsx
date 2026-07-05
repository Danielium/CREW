"use client";
import React, { useState, useEffect } from "react";
import { ArrowLeft, Check, Zap, Flame, Skull, Sword, Shield, Mountain, Anchor, Crown, Star, Heart, Activity, Target, Trophy, Ghost, Crosshair, HelpCircle } from "lucide-react";
import ClubBadge, { ShapeType, PatternType } from "@/components/ClubBadge";

const SHAPES: { id: ShapeType; name: string }[] = [
  { id: "square", name: "Квадрат" },
  { id: "triangle", name: "Треугольник" },
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
  const [shape, setShape] = useState<ShapeType>("circle");
  const [pattern, setPattern] = useState<PatternType>("solid");
  const [color1, setColor1] = useState(COLORS[5]);
  const [color2, setColor2] = useState(COLORS[6]);
  const [icon, setIcon] = useState("Zap");
  const [iconColor, setIconColor] = useState(COLORS[6]);
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"shape" | "pattern" | "color" | "icon" | "photo">("shape");

  // Hide BottomNav on mount and load existing config
  useEffect(() => {
    window.dispatchEvent(new Event("hideNav"));
    
    // Load existing config if available
    try {
      const savedConfig = localStorage.getItem("clubLogoConfig");
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        if (parsed.shape) setShape(parsed.shape);
        if (parsed.pattern) setPattern(parsed.pattern);
        if (parsed.color1) setColor1(parsed.color1);
        if (parsed.color2) setColor2(parsed.color2);
        if (parsed.iconName) setIcon(parsed.iconName);
        if (parsed.iconColor) setIconColor(parsed.iconColor);
        if (parsed.imageUrl) setImageUrl(parsed.imageUrl);
      }
    } catch (e) {
      console.error("Failed to parse existing logo config", e);
    }

    return () => {
      window.dispatchEvent(new Event("showNav"));
    };
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_SIZE = 300;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
          setImageUrl(compressedBase64);
          setIsUploading(false);
        };
        img.onerror = () => {
          alert("Ошибка чтения картинки");
          setIsUploading(false);
        };
        img.src = reader.result as string;
      };
      reader.onerror = () => {
        alert("Ошибка файла");
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.error(e);
      alert("Ошибка загрузки");
      setIsUploading(false);
    }
  };

  const handleSave = () => {
    const config = { shape, pattern, color1, color2, iconName: icon, iconColor, imageUrl };
    localStorage.setItem("clubLogoConfig", JSON.stringify(config));
    window.history.back();
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-background text-foreground z-50 overflow-hidden">
      
      {/* Header */}
      <div className="flex justify-between items-center px-4 pt-[60px] pb-4 bg-card border-b border-border">
        <button 
          onClick={() => window.history.back()}
          className="p-2 -ml-2 rounded-full text-foreground hover:bg-border transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Эмблема</h1>
        <button 
          onClick={handleSave}
          className="p-2 -mr-2 rounded-full text-primary hover:bg-border transition-colors"
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
          imageUrl={imageUrl}
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
          { id: "photo", label: "Фото" },
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

        {activeTab === "photo" && (
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
            {imageUrl ? (
              <>
                <button onClick={() => fileInputRef.current?.click()} className="py-4 px-8 rounded-2xl bg-muted text-foreground font-bold uppercase tracking-wider text-sm active:scale-95 transition-transform">
                  {isUploading ? "Загрузка..." : "Изменить фото"}
                </button>
                <button onClick={() => setImageUrl(undefined)} className="py-4 px-8 rounded-2xl bg-red-500/10 text-red-500 font-bold uppercase tracking-wider text-sm active:scale-95 transition-transform">
                  Удалить фото
                </button>
              </>
            ) : (
              <button onClick={() => fileInputRef.current?.click()} className="py-4 px-8 rounded-2xl bg-primary text-black font-bold uppercase tracking-wider text-sm active:scale-95 transition-transform">
                {isUploading ? "Загрузка..." : "Загрузить фото"}
              </button>
            )}
          </div>
        )}

      </div>

    </div>
  );
}
