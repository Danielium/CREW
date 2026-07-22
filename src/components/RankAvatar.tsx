import React from 'react';
import { getRankStyle } from './AvatarProgress';

interface RankAvatarProps {
  user: {
    image?: string | null;
    name?: string | null;
    totalDistance?: number;
  };
  size?: number; // size of the image itself
  className?: string;
}

export default function RankAvatar({ user, size = 40, className = "" }: RankAvatarProps) {
  const distance = user?.totalDistance || 0;
  const style = getRankStyle(distance);
  
  const bgStyle = style.type === "gradient" && style.stops
    ? { background: `linear-gradient(135deg, ${style.stops[0].color}, ${style.stops[1].color}, ${style.stops[2].color})` }
    : { background: style.color };

  return (
    <div 
      className={`rounded-full shrink-0 flex items-center justify-center p-[2px] ${className}`}
      style={{ width: size + 4, height: size + 4, ...bgStyle }}
    >
      <div className="bg-background rounded-full w-full h-full overflow-hidden flex items-center justify-center">
        {user?.image ? (
          <img 
            src={user.image} 
            alt={user.name || "Avatar"} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted"></div>
        )}
      </div>
    </div>
  );
}
