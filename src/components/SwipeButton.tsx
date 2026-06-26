"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';

interface SwipeButtonProps {
  onConfirm: () => Promise<void> | void;
  text?: string;
  successText?: string;
}

export function SwipeButton({ 
  onConfirm, 
  text = "Побежали?", 
  successText = "Запрос отправлен!" 
}: SwipeButtonProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
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
    if (isSuccess || isLoading) return;
    setIsDragging(true);
    setStartX(e.clientX - currentX);
    triggerHaptic('light');
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || isSuccess || isLoading) return;
    
    let newX = e.clientX - startX;
    if (newX < 0) newX = 0;
    if (newX >= maxSwipe) {
      newX = maxSwipe;
      handleSuccess();
    }
    
    setCurrentX(newX);
  };

  const handlePointerUp = () => {
    if (!isDragging || isSuccess || isLoading) return;
    setIsDragging(false);
    
    if (currentX < maxSwipe) {
      setCurrentX(0); // Snap back
      triggerHaptic('light');
    }
  };

  const handleSuccess = async () => {
    setIsDragging(false);
    setIsLoading(true);
    triggerHaptic('heavy');
    
    try {
      await onConfirm();
      setIsSuccess(true);
    } catch (e) {
      setCurrentX(0);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-16 rounded-full overflow-hidden flex items-center select-none touch-none transition-colors duration-300 ${isSuccess ? 'bg-primary text-black' : 'bg-card border border-border'}`}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Background Text */}
      <div className="absolute inset-0 flex items-center justify-center font-black uppercase tracking-wider text-sm pointer-events-none z-0">
        {isLoading ? (
          <Loader2 className="animate-spin text-primary" />
        ) : isSuccess ? (
          successText
        ) : (
          <span className="text-muted/60 pl-8">{text}</span>
        )}
      </div>

      {/* Swipe Progress Fill */}
      {!isSuccess && !isLoading && (
        <div 
          className="absolute top-0 left-0 bottom-0 bg-primary/20 transition-all z-0 rounded-full"
          style={{ width: `${currentX + 64}px` }} // 64 is approx thumb width
        />
      )}

      {/* Draggable Thumb */}
      {!isSuccess && !isLoading && (
        <div 
          ref={thumbRef}
          className="absolute left-1 top-1 bottom-1 w-14 bg-primary rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing z-10 shadow-lg"
          style={{ 
            transform: `translateX(${currentX}px)`,
            transition: isDragging ? 'none' : 'transform 0.3s ease-out'
          }}
          onPointerDown={handlePointerDown}
        >
          <ChevronRight className="text-black" size={24} />
          <ChevronRight className="text-black -ml-4 opacity-50" size={24} />
        </div>
      )}
    </div>
  );
}
