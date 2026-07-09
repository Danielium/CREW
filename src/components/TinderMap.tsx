"use client";
import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, CircleMarker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { renderToStaticMarkup } from "react-dom/server";
import { Zap, Flame, Skull, Sword, Shield, Mountain, Anchor, Crown, Star, Heart, Activity, Target, Trophy, Ghost, Crosshair, HelpCircle } from "lucide-react";
import UserLocationMarker from "./UserLocationMarker";
import ClubBadge from "./ClubBadge";

const ICON_MAP: Record<string, any> = {
  Zap, Flame, Skull, Sword, Shield, Mountain, Anchor, Crown, Star, Heart, Activity, Target, Trophy, Ghost, Crosshair
};

// Fix Leaflet default icon path issues in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const crewIcon = new L.DivIcon({
  html: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#CCFF00" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 32px; height: 32px; filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.5));">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      <circle cx="12" cy="10" r="3" fill="#000"></circle>
    </svg>
  `,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

function MapController({ onMapClick, forceCenter }: any) {
  const map = useMapEvents({
    click: (e) => {
      if (onMapClick) onMapClick(e.latlng);
    }
  });

  useEffect(() => {
    map.invalidateSize();
  }, [map]);

  useEffect(() => {
    if (forceCenter) {
      map.setView(forceCenter, 14);
    }
  }, [forceCenter, map]);

  return null;
}



const getInitialCenter = (): [number, number] => {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('lastKnownLocation');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length === 2) return parsed;
      }
    } catch (e) {}
  }
  return [55.7558, 37.6173];
};

export default function TinderMap({ proposals, onSelectProposal, onMapClick, forceCenter, triggerLocate }: { proposals: any[], onSelectProposal: (p: any) => void, onMapClick?: (latlng: any) => void, forceCenter?: [number, number] | null, triggerLocate?: number }) {
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);
  const [hasFlown, setHasFlown] = useState(false);
  const [defaultCenter] = useState<[number, number]>(getInitialCenter());

  const handleSetInitialLocation = (latlng: [number, number]) => {
    localStorage.setItem('lastKnownLocation', JSON.stringify(latlng));
    if (!hasFlown) {
      setInitialCenter(latlng);
      setHasFlown(true);
    }
  };

  return (
    <div className="w-full h-[100dvh] absolute top-0 left-0 z-0">
      <MapContainer
        center={defaultCenter}
        zoom={14}
        style={{ width: "100%", height: "100%" }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        
        <MapController onMapClick={onMapClick} forceCenter={forceCenter || initialCenter} />

        {proposals.map(p => {
          let icon = crewIcon;
          if (p.type === "CLUB" && p.event?.club?.logoConfig) {
            let logoConfig: any = {};
            try {
              logoConfig = JSON.parse(p.event.club.logoConfig);
            } catch(e) {}
            
            const bg = logoConfig.color1 || "#CCFF00";
            const iconColor = logoConfig.iconColor || "#000000";
            const shape = logoConfig.shape || "circle";
            const IconComp = ICON_MAP[logoConfig.iconName] || HelpCircle;
            
            // Adjust icon size
            const iconSize = shape === "triangle" ? 18 : 22;
            const iconY = shape === "triangle" ? 12 : 9; // slightly lower for triangle
            let iconHtml = renderToStaticMarkup(<IconComp size={iconSize} color={iconColor} strokeWidth={2.5} />);

            let svgShape = `<circle cx="20" cy="20" r="18.5" fill="${bg}" stroke="white" stroke-width="3" />`;
            if (shape === "triangle") {
              svgShape = `<polygon points="20,2 2,38 38,38" fill="${bg}" stroke="white" stroke-width="3" stroke-linejoin="round" />`;
            } else if (shape === "octagon") {
              svgShape = `<polygon points="12,2 28,2 38,12 38,28 28,38 12,38 2,28 2,12" fill="${bg}" stroke="white" stroke-width="3" stroke-linejoin="round" />`;
            } else if (shape === "square") {
              svgShape = `<rect x="2" y="2" width="36" height="36" rx="6" fill="${bg}" stroke="white" stroke-width="3" />`;
            }

            let defs = "";
            let imageTag = "";
            if (logoConfig.imageUrl) {
              defs = `<defs><clipPath id="clip-${p.id}">${svgShape}</clipPath></defs>`;
              imageTag = `<image href="${logoConfig.imageUrl}" width="40" height="40" preserveAspectRatio="xMidYMid slice" clip-path="url(#clip-${p.id})" />`;
              svgShape = svgShape.replace(/fill="[^"]+"/, 'fill="transparent"');
              iconHtml = ""; // Don't show lucide icon if there's a photo
            }
            
            icon = new L.DivIcon({
              html: `
                <div style="width: 40px; height: 40px; filter: drop-shadow(0px 6px 6px rgba(0,0,0,0.4)); display: flex; align-items: center; justify-content: center; position: relative;">
                  <svg width="40" height="40" viewBox="0 0 40 40" style="position: absolute; top: 0; left: 0; z-index: 1;">
                    ${defs}
                    ${imageTag}
                    ${svgShape}
                  </svg>
                  <div style="position: absolute; top: ${iconY}px; left: ${20 - iconSize/2}px; width: ${iconSize}px; height: ${iconSize}px; z-index: 2; display: flex; align-items: center; justify-content: center;">
                    ${iconHtml}
                  </div>
                </div>
              `,
              className: '',
              iconSize: [40, 40],
              iconAnchor: [20, 40],
            });
          }

          return (
            <Marker 
              key={p.type === "CLUB" ? `club-${p.id}` : p.id} 
              position={[p.lat, p.lng]} 
              icon={icon}
              eventHandlers={{
                click: () => onSelectProposal(p)
              }}
            />
          );
        })}

        <UserLocationMarker onLocationFound={handleSetInitialLocation} triggerLocate={triggerLocate} />
      </MapContainer>
    </div>
  );
}
