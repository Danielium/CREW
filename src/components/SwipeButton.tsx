"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';

interface SwipeButtonProps {
  onConfirm: () => Promise<void> | void;
  text?: string;
  successText?: string;
  variant?: "default" | "cancel";
}

export function SwipeButton({ 
  onConfirm, 
  text = "Побежали?", 
  successText = "Запрос отправлен!",
  variant = "default"
}: SwipeButtonProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  const maxSwipe = containerRef.current && thumbRef.current 
    ? containerRef.current.clientWidth - thumbRef.current.clientWidth - 8 // 4px padding each side
    : 200;

  useEffect(() => {
    if (currentX > 0 && currentX < maxSwipe) {
      // Small haptic ticks as you drag
      if (currentX % 50 < 5) {
        triggerHaptic('light');
      }
    }
  }, [currentX, maxSwipe]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isSuccess) return;
    setIsDragging(true);
    setStartX(variant === "cancel" ? e.clientX + currentX : e.clientX - currentX);
    triggerHaptic('light');
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || isSuccess) return;
    
    let newX = variant === "cancel" ? startX - e.clientX : e.clientX - startX;
    if (newX < 0) newX = 0;
    if (newX >= maxSwipe) {
      newX = maxSwipe;
      handleSuccess();
    }
    
    setCurrentX(newX);
  };

  const handlePointerUp = () => {
    if (!isDragging || isSuccess) return;
    setIsDragging(false);
    
    if (currentX < maxSwipe) {
      setCurrentX(0); // Snap back
      triggerHaptic('light');
    }
  };

  const handleSuccess = async () => {
    setIsDragging(false);
    setIsSuccess(true);
    triggerHaptic('heavy');
    
    try {
      // Don't await if we want optimistic UI!
      // Or we can await, but since we removed isLoading, it won't show a spinner.
      await onConfirm();
    } catch (e) {
      setCurrentX(0);
      setIsSuccess(false);
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-16 rounded-full overflow-hidden flex items-center select-none touch-none transition-colors duration-300 ${
        isSuccess 
          ? (variant === "cancel" ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-primary text-black') 
          : (variant === "cancel" ? 'bg-red-500/10 border border-red-500/30' : 'bg-card border border-border')
      }`}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Background Text */}
      <div className={`absolute inset-0 flex items-center justify-center font-black uppercase tracking-wider text-sm pointer-events-none z-0 ${variant === "cancel" && !isSuccess ? "text-red-500/80 pr-8" : variant === "cancel" ? "text-red-500" : ""}`}>
        {isSuccess ? (
          successText
        ) : (
          <span className={variant === "cancel" ? "" : "text-muted/60 pl-8"}>{text}</span>
        )}
      </div>

      {/* Swipe Progress Fill */}
      {!isSuccess && (
        <div 
          className={`absolute top-0 bottom-0 transition-all z-0 rounded-full ${variant === "cancel" ? "right-0 bg-red-500/20" : "left-0 bg-primary/20"}`}
          style={{ width: `${currentX + 64}px` }} // 64 is approx thumb width
        />
      )}

      {/* Draggable Thumb */}
      {!isSuccess && (
        <div 
          ref={thumbRef}
          className={`absolute ${variant === "cancel" ? "right-1 bg-red-500 text-white" : "left-1 bg-primary text-black"} top-1 bottom-1 w-14 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing z-10 shadow-lg`}
          style={{ 
            transform: `translateX(${variant === "cancel" ? -currentX : currentX}px)`,
            transition: isDragging ? 'none' : 'transform 0.3s ease-out'
          }}
          onPointerDown={handlePointerDown}
        >
          {variant === "cancel" ? (
            <>
              <ChevronLeft size={24} />
              <ChevronLeft className="-ml-4 opacity-50" size={24} />
            </>
          ) : (
            <>
              <ChevronRight size={24} />
              <ChevronRight className="-ml-4 opacity-50" size={24} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
