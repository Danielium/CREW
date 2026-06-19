import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '@/lib/cropImage';
import { X, Check } from 'lucide-react';

interface ImageCropperModalProps {
  imageSrc: string;
  onCropComplete: (croppedFile: File, croppedUrl: string) => void;
  onClose: () => void;
}

export function ImageCropperModal({ imageSrc, onCropComplete, onClose }: ImageCropperModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onCropCompleteInternal = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels, 0);
      if (croppedImage) {
        onCropComplete(croppedImage, URL.createObjectURL(croppedImage));
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-background">
      <div className="flex justify-between items-center p-4 z-10 border-b border-border bg-card">
        <button onClick={onClose} className="p-2 text-muted hover:text-foreground">
          <X size={24} />
        </button>
        <h3 className="font-black uppercase">Обрезать фото</h3>
        <button onClick={handleSave} className="p-2 text-primary font-bold hover:text-white transition-colors flex items-center gap-1">
          <Check size={20} /> Готово
        </button>
      </div>

      <div className="relative flex-1 bg-black w-full h-full">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onCropComplete={onCropCompleteInternal}
          onZoomChange={setZoom}
        />
      </div>

      <div className="p-6 bg-card border-t border-border z-10">
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted font-bold">Zoom</span>
          <input
            type="range"
            value={zoom}
            min={1}
            max={3}
            step={0.1}
            aria-labelledby="Zoom"
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-primary h-2 bg-border rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
