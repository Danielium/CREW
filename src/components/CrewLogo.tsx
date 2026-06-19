import React from 'react';

export function CrewLogo({ size = 24, className = "" }: { size?: number, className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 112 112" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M65 84L86 63" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
      <path d="M25 49L46 28" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
      <path d="M16 73L69 19" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
      <path d="M37 68L90 14" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
      <path d="M22 98L75 44" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
      <path d="M43 92L96 38" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
    </svg>
  );
}
