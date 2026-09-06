"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { renderToStaticMarkup } from "react-dom/server";
import { Zap, Flame, Skull, Sword, Shield, Mountain, Anchor, Crown, Star, Heart, Activity, Target, Trophy, Ghost, Crosshair, HelpCircle } from "lucide-react";
import UserLocationMarker from "./UserLocationMarker";
import { MAP_STYLE_URL } from "@/lib/mapTiles";

const ICON_MAP: Record<string, any> = {
  Zap, Flame, Skull, Sword, Shield, Mountain, Anchor, Crown, Star, Heart, Activity, Target, Trophy, Ghost, Crosshair
};

function crewPinHtml() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#CCFF00" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 32px; height: 32px; filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.5));">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      <circle cx="12" cy="10" r="3" fill="#000"></circle>
    </svg>
  `;
}

// Draft pin shown while placing a new run proposal (before it's saved)
function draftPinHtml() {
  return `
    <div style="position: relative; width: 32px; height: 32px;">
      <div style="position: absolute; top: 8px; left: 8px; width: 16px; height: 16px; border-radius: 50%; background: rgba(204,255,0,0.35); animation: draftPulse 1.6s ease-out infinite;"></div>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#CCFF00" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position:absolute; width: 32px; height: 32px; filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.5));">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3" fill="#000"></circle>
      </svg>
      <style>@keyframes draftPulse { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(2.4); opacity: 0; } }</style>
    </div>
  `;
}

function clubPinHtml(p: any) {
  let logoConfig: any = {};
  try {
    logoConfig = JSON.parse(p.event.club.logoConfig);
  } catch (e) {}

  const bg = logoConfig.color1 || "#CCFF00";
  const iconColor = logoConfig.iconColor || "#000000";
  const shape = logoConfig.shape || "circle";
  const IconComp = ICON_MAP[logoConfig.iconName] || HelpCircle;

  const iconSize = shape === "triangle" ? 18 : 22;
  const iconY = shape === "triangle" ? 12 : 9;
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

  return `
    <div style="width: 40px; height: 40px; filter: drop-shadow(0px 6px 6px rgba(0,0,0,0.4)); display: flex; align-items: center; justify-content: center; position: relative;">
      <svg width="40" height="40" viewBox="0 0 40 40" style="position: absolute; top: 0; left: 0; z-index: 1;">
        ${defs}
        ${imageTag}
        ${svgShape}
      </svg>
      <div style="position: absolute; top: ${iconY}px; left: ${20 - iconSize / 2}px; width: ${iconSize}px; height: ${iconSize}px; z-index: 2; display: flex; align-items: center; justify-content: center;">
        ${iconHtml}
      </div>
    </div>
  `;
}

const DEFAULT_CENTER: [number, number] = [55.7558, 37.6173]; // Moscow fallback, [lat, lng]

export default function TinderMap({ proposals, onSelectProposal, onMapClick, forceCenter, triggerLocate, onLocationFound, draftPosition }: { proposals: any[], onSelectProposal: (p: any) => void, onMapClick?: (latlng: any) => void, forceCenter?: [number, number] | null, triggerLocate?: number, onLocationFound?: (latlng: [number, number]) => void, draftPosition?: [number, number] | null }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const draftMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);
  const hasFlown = useRef(false);
  const onSelectProposalRef = useRef(onSelectProposal);
  const onMapClickRef = useRef(onMapClick);

  useEffect(() => { onSelectProposalRef.current = onSelectProposal; }, [onSelectProposal]);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);

  const handleSetInitialLocation = (latlng: [number, number]) => {
    if (onLocationFound) onLocationFound(latlng);
    if (!hasFlown.current) {
      hasFlown.current = true;
      setInitialCenter(latlng);
    }
  };

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current) return;
    const instance = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: [DEFAULT_CENTER[1], DEFAULT_CENTER[0]],
      zoom: 14,
      attributionControl: false,
    });
    instance.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    instance.on("click", (e: maplibregl.MapMouseEvent) => {
      onMapClickRef.current?.(e.lngLat);
    });
    mapRef.current = instance;
    setMap(instance);

    return () => {
      instance.remove();
      mapRef.current = null;
      setMap(null);
    };
  }, []);

  // Fly to forced or first-detected center.
  useEffect(() => {
    const target = forceCenter || initialCenter;
    if (!target || !map) return;
    map.flyTo({ center: [target[1], target[0]], zoom: 14, duration: 1500 });
  }, [forceCenter, initialCenter, map]);

  // Sync proposal markers.
  useEffect(() => {
    if (!map) return;
    const nextIds = new Set<string>();

    for (const p of proposals) {
      const key = p.type === "CLUB" ? `club-${p.id}` : p.id;
      nextIds.add(key);

      const html = p.type === "CLUB" && p.event?.club?.logoConfig ? clubPinHtml(p) : crewPinHtml();

      let marker = markersRef.current.get(key);
      if (!marker) {
        const el = document.createElement("div");
        el.style.cursor = "pointer";
        el.innerHTML = html;
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectProposalRef.current(p);
        });
        marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([p.lng, p.lat])
          .addTo(map);
        markersRef.current.set(key, marker);
      } else {
        marker.setLngLat([p.lng, p.lat]);
        marker.getElement().innerHTML = html;
      }
    }

    for (const [key, marker] of markersRef.current) {
      if (!nextIds.has(key)) {
        marker.remove();
        markersRef.current.delete(key);
      }
    }
  }, [proposals, map]);

  // Draft pin while placing a new run proposal.
  useEffect(() => {
    if (!map) return;
    if (!draftPosition) {
      draftMarkerRef.current?.remove();
      draftMarkerRef.current = null;
      return;
    }
    if (!draftMarkerRef.current) {
      const el = document.createElement("div");
      el.innerHTML = draftPinHtml();
      draftMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([draftPosition[1], draftPosition[0]])
        .addTo(map);
    } else {
      draftMarkerRef.current.setLngLat([draftPosition[1], draftPosition[0]]);
    }
  }, [draftPosition, map]);

  return (
    <div className="w-full h-full absolute top-0 left-0 z-0 map-fullscreen">
      <div ref={containerRef} className="w-full h-full" />
      <UserLocationMarker map={map} onLocationFound={handleSetInitialLocation} triggerLocate={triggerLocate} />
    </div>
  );
}
