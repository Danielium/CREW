"use client";

import { useRef, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import ClubBadge from "@/components/ClubBadge";
import { ImageCropperModal } from "@/components/ImageCropperModal";
import { Spinner } from "@/components/Loading";
import { uploadImage } from "@/lib/uploadImage";

export type SimpleLogoConfig = {
  pattern: "solid";
  color1: string;
  color2?: string;
  iconName: string;
  iconColor: string;
  imageUrl?: string;
};

/** Perceptual luminance so the fallback icon stays legible against the badge fill. */
export function contrastIconColor(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111111" : "#FFFFFF";
}

/** Used for clubs that never uploaded a photo — the badge falls back to brand color + flag. */
export const DEFAULT_SIMPLE_LOGO: SimpleLogoConfig = {
  pattern: "solid",
  color1: "#CCFF00",
  iconName: "Flag",
  iconColor: contrastIconColor("#CCFF00"),
};

export default function ClubLogoPicker({
  value,
  onChange,
}: {
  value: SimpleLogoConfig;
  onChange: (next: SimpleLogoConfig) => void;
}) {
  const hasPhoto = !!value.imageUrl;
  const [isUploading, setIsUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-[22px]">
            <Spinner size={24} className="text-white" />
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
        <ImageCropperModal imageSrc={cropSrc} cropShape="rect" onCropComplete={handleCropComplete} onClose={() => setCropSrc(null)} />
      )}
    </div>
  );
}
