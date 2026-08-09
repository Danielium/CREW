"use client";

import { useRef, useState } from "react";
import { Zap, Flame, Shield, Crown, Star, Heart, Activity, Target, Trophy, Mountain, Flag, Check, Image as ImageIcon, Loader2, ChevronDown, Palette } from "lucide-react";
import ClubBadge, { ShapeType } from "@/components/ClubBadge";
import { ImageCropperModal } from "@/components/ImageCropperModal";
import { uploadImage } from "@/lib/uploadImage";

export type SimpleLogoConfig = {
  shape: ShapeType;
  pattern: "solid";
  color1: string;
  color2?: string;
  iconName: string;
  iconColor: string;
  imageUrl?: string;
};

const SHAPES: { id: ShapeType; name: string }[] = [
  { id: "circle", name: "Круг" },
  { id: "square", name: "Квадрат" },
  { id: "octagon", name: "Октагон" },
  { id: "triangle", name: "Треугольник" },
];

// Curated for a running club — dropped the leftover fantasy/combat set
// (Skull, Sword, Anchor, Ghost, Crosshair) that shipped with the original
// icon grid; ClubBadge's ICON_MAP still recognizes them so old clubs that
// picked one keep rendering correctly.
const ICONS: { id: string; Comp: any }[] = [
  { id: "Flag", Comp: Flag },
  { id: "Zap", Comp: Zap },
  { id: "Activity", Comp: Activity },
  { id: "Target", Comp: Target },
  { id: "Trophy", Comp: Trophy },
  { id: "Mountain", Comp: Mountain },
  { id: "Flame", Comp: Flame },
  { id: "Shield", Comp: Shield },
  { id: "Crown", Comp: Crown },
  { id: "Star", Comp: Star },
  { id: "Heart", Comp: Heart },
];

const COLORS = [
  "#CCFF00", // Acid Green (brand)
  "#FF3366", // Cyber Pink
  "#00E5FF", // Electric Blue
  "#FF6B00", // Bright Orange
  "#8A2BE2", // Purple
  "#FFFFFF", // White
  "#111111", // Pitch Black
  "#8E8E93", // Gray
];

/** Perceptual luminance so the icon stays legible against any swatch — no manual icon-color picker needed. */
export function contrastIconColor(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111111" : "#FFFFFF";
}

export const DEFAULT_SIMPLE_LOGO: SimpleLogoConfig = {
  shape: "circle",
  pattern: "solid",
  color1: "#CCFF00",
  iconName: "Flag",
  iconColor: contrastIconColor("#CCFF00"),
};

export default function ClubLogoPicker({
  value,
  onChange,
  startExpanded = false,
}: {
  value: SimpleLogoConfig;
  onChange: (next: SimpleLogoConfig) => void;
  /** Show the shape/color/icon builder open by default — for editing a club whose current logo is already parametric, not a photo. */
  startExpanded?: boolean;
}) {
  const hasPhoto = !!value.imageUrl;
  const [isUploading, setIsUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(startExpanded);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setShape = (shape: ShapeType) => onChange({ ...value, shape });
  const setColor = (color1: string) => onChange({ ...value, color1, iconColor: contrastIconColor(color1) });
  const setIcon = (iconName: string) => onChange({ ...value, iconName });
  const dropPhoto = () => onChange({ ...value, imageUrl: undefined });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) setCropSrc(event.target.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (file: File, previewUrl: string) => {
    setCropSrc(null);
    setIsUploading(true);
    onChange({ ...value, imageUrl: previewUrl });
    const uploadedUrl = await uploadImage(file, "club-logos");
    setIsUploading(false);
    if (uploadedUrl) {
      onChange({ ...value, imageUrl: uploadedUrl });
    } else {
      alert("Не удалось загрузить фото");
      onChange({ ...value, imageUrl: undefined });
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />

      {/* Preview only — the button below is the single, unambiguous way to upload. */}
      <div className="relative drop-shadow-xl">
        <ClubBadge {...value} size={128} />
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
            <Loader2 size={24} className="animate-spin text-white" />
          </div>
        )}
      </div>

      {hasPhoto ? (
        <div className="flex gap-2 w-full">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-3.5 rounded-2xl bg-primary text-black font-black uppercase tracking-wider text-sm hover:bg-[#b3e600] active:scale-[0.98] transition-all"
          >
            Заменить фото
          </button>
          <button
            onClick={dropPhoto}
            className="px-4 py-3.5 rounded-2xl bg-white/10 text-muted text-xs font-bold uppercase tracking-wider hover:bg-white/15 transition-colors"
          >
            Убрать
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-3.5 rounded-2xl bg-primary text-black font-black uppercase tracking-wider text-sm flex items-center justify-center gap-2 hover:bg-[#b3e600] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(204,255,0,0.25)]"
        >
          <ImageIcon size={16} /> Загрузить фото клуба
        </button>
      )}

      {cropSrc && (
        <ImageCropperModal imageSrc={cropSrc} onCropComplete={handleCropComplete} onClose={() => setCropSrc(null)} />
      )}

      {/* Constructor is the secondary path — collapsed by default so photo reads as the default choice. */}
      {!hasPhoto && (
        <div className="w-full">
          <button
            onClick={() => setBuilderOpen((v) => !v)}
            aria-expanded={builderOpen}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl border text-xs font-bold uppercase tracking-wider transition-colors ${
              builderOpen ? "border-primary/40 bg-primary/5 text-primary" : "border-white/10 text-muted hover:border-white/20 hover:text-foreground"
            }`}
          >
            <Palette size={14} /> Или собери эмблему сам
            <ChevronDown size={14} className={`transition-transform ${builderOpen ? "rotate-180" : ""}`} />
          </button>

          {builderOpen && (
            <div className="w-full flex flex-col gap-6 mt-3 pt-5 border-t border-white/5">
              <div className="w-full">
                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">Форма</p>
                <div className="grid grid-cols-2 gap-2">
                  {SHAPES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setShape(s.id)}
                      aria-pressed={value.shape === s.id}
                      aria-label={s.name}
                      className={`h-12 rounded-xl border-2 flex items-center justify-center text-xs font-bold uppercase transition-colors ${
                        value.shape === s.id ? "border-primary text-primary bg-primary/10" : "border-white/10 text-muted"
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full">
                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">Цвет</p>
                <div className="flex flex-wrap gap-3">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      aria-pressed={value.color1 === c}
                      aria-label={`Цвет ${c}`}
                      className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition-transform active:scale-95 ${
                        value.color1 === c ? "border-primary" : "border-white/10"
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {value.color1 === c && <Check size={16} color={contrastIconColor(c)} strokeWidth={3} />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full">
                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">Иконка</p>
                <div className="grid grid-cols-5 gap-2">
                  {ICONS.map(({ id, Comp }) => (
                    <button
                      key={id}
                      onClick={() => setIcon(id)}
                      aria-pressed={value.iconName === id}
                      aria-label={id}
                      className={`aspect-square min-h-11 rounded-xl flex items-center justify-center border-2 transition-colors ${
                        value.iconName === id ? "border-primary bg-primary/10 text-primary" : "border-white/10 text-foreground"
                      }`}
                    >
                      <Comp size={22} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
