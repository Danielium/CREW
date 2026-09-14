"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { renderToStaticMarkup } from "react-dom/server";
import UserLocationMarker from "./UserLocationMarker";
import { MAP_STYLE_URL } from "@/lib/mapTiles";
import ClubBadge, { parseClubLogo, BADGE_CLIP_PATH } from "@/components/ClubBadge";

// One pin chassis for every marker on the map: a photo (person = circle, club = squircle,
// same shapes as everywhere else in the app) ringed in the brand lime so forty different
// photos still read as one system, sitting on a tail that gives the exact meeting point —
// a plain photo has no "this pixel is the coordinate" the way a teardrop does.
const PIN_SIZE = 44;
const PIN_RING = 3;
const PIN_GAP = 2;
const PIN_TAIL_H = 8;
const PIN_TAIL_W = 14;
const RING_BOX = PIN_SIZE + PIN_RING * 2;
const GAP_BOX = PIN_SIZE + PIN_GAP * 2;
const CHASSIS_H = RING_BOX + PIN_TAIL_H;

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function escapeCssUrl(url: string) {
  return url.replace(/'/g, "%27");
}

function pinChassisHtml(shape: "circle" | "squircle", contentHtml: string) {
  const shapeCss = shape === "circle" ? "border-radius:50%;" : `clip-path:${BADGE_CLIP_PATH};`;
  return `
    <div class="crew-pin" style="position:relative; width:${RING_BOX}px; height:${CHASSIS_H}px; transform:scale(1); transform-origin:bottom center; transition:transform 150ms ease-out;">
      <div style="position:absolute; top:0; left:0; width:${RING_BOX}px; height:${RING_BOX}px; background:#CCFF00; ${shapeCss}"></div>
      <div style="position:absolute; top:${PIN_RING}px; left:${PIN_RING}px; width:${GAP_BOX}px; height:${GAP_BOX}px; background:#FFFFFF; ${shapeCss}"></div>
      <div style="position:absolute; top:${PIN_RING + PIN_GAP}px; left:${PIN_RING + PIN_GAP}px; width:${PIN_SIZE}px; height:${PIN_SIZE}px; overflow:hidden; ${shapeCss}">
        ${contentHtml}
      </div>
      <div style="position:absolute; top:${RING_BOX - 1}px; left:50%; transform:translateX(-50%); width:0; height:0; border-left:${PIN_TAIL_W / 2}px solid transparent; border-right:${PIN_TAIL_W / 2}px solid transparent; border-top:${PIN_TAIL_H + 1}px solid #CCFF00;"></div>
    </div>
  `;
}

function personAvatarHtml(name?: string | null, image?: string | null) {
  if (image) {
    return `<div style="width:100%; height:100%; background-image:url('${escapeCssUrl(image)}'); background-size:cover; background-position:center;"></div>`;
  }
  const initial = escapeHtml((name || "?").charAt(0).toUpperCase());
  return `<div style="width:100%; height:100%; background:#1C1C1E; display:flex; align-items:center; justify-content:center; color:#CCFF00; font-weight:700; font-size:18px;">${initial}</div>`;
}

function markerChassisHtml(p: any): string {
  if (p.type === "CLUB") {
    // parseClubLogo(null) -> null, so an event whose club never set a logo still gets a
    // proper squircle chassis with ClubBadge's own colour+icon fallback, instead of the
    // solo teardrop this used to silently fall back to.
    const logo = parseClubLogo(p.event?.club?.logoConfig) || {};
    const badgeHtml = renderToStaticMarkup(<ClubBadge {...logo} size={PIN_SIZE} />);
    return pinChassisHtml("squircle", badgeHtml);
  }
  return pinChassisHtml("circle", personAvatarHtml(p.creator?.name, p.creator?.image));
}

// Draft pin shown while placing a new run proposal (before it's saved) — the user's own
// avatar in the same circle chassis, so what you see while dragging is "this will be me".
function draftPinHtml(currentUser?: { name?: string | null; image?: string | null }) {
  const haloSize = RING_BOX + 20;
  const chassis = pinChassisHtml("circle", personAvatarHtml(currentUser?.name, currentUser?.image));
  return `
    <div style="position:relative; width:${haloSize}px; height:${CHASSIS_H}px; display:flex; align-items:flex-end; justify-content:center; filter: drop-shadow(0px 4px 6px rgba(0,0,0,0.45));">
      <div style="position:absolute; bottom:${PIN_TAIL_H}px; left:50%; width:${haloSize}px; height:${haloSize}px; border-radius:50%; background:rgba(204,255,0,0.35); transform:translate(-50%, 50%); animation: draftPulse 1.6s ease-out infinite;"></div>
      ${chassis}
      <style>@keyframes draftPulse { 0% { transform: translate(-50%, 50%) scale(0.6); opacity: 0.8; } 100% { transform: translate(-50%, 50%) scale(1.4); opacity: 0; } }</style>
    </div>
  `;
}

const DEFAULT_CENTER: [number, number] = [55.7558, 37.6173]; // Moscow fallback, [lat, lng]

export default function TinderMap({ proposals, onSelectProposal, onMapClick, forceCenter, triggerLocate, onLocationFound, draftPosition, currentUser }: { proposals: any[], onSelectProposal: (p: any) => void, onMapClick?: (latlng: any) => void, forceCenter?: [number, number] | null, triggerLocate?: number, onLocationFound?: (latlng: [number, number]) => void, draftPosition?: [number, number] | null, currentUser?: { name?: string | null; image?: string | null } }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const draftMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);
  const hasFlown = useRef(false);
  const onSelectProposalRef = useRef(onSelectProposal);
  const onMapClickRef = useRef(onMapClick);
  // Marker clicks are bound once at DOM-creation time; the 10s polling refresh only swaps
  // innerHTML, so a listener that closed over the proposal object itself would fire with
  // stale data forever after the first refresh. It resolves the live proposal by key instead.
  const proposalsByIdRef = useRef<Map<string, any>>(new Map());
  const activeKeyRef = useRef<string | null>(null);
  const currentUserRef = useRef(currentUser);

  useEffect(() => { onSelectProposalRef.current = onSelectProposal; }, [onSelectProposal]);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

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
    const byId = new Map<string, any>();
    for (const p of proposals) {
      byId.set(p.type === "CLUB" ? `club-${p.id}` : p.id, p);
    }
    proposalsByIdRef.current = byId;

    for (const p of proposals) {
      const key = p.type === "CLUB" ? `club-${p.id}` : p.id;
      nextIds.add(key);

      const html = markerChassisHtml(p);

      let marker = markersRef.current.get(key);
      if (!marker) {
        const el = document.createElement("div");
        el.style.cursor = "pointer";
        el.innerHTML = html;
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          // No z-index API on maplibre-gl's Marker in this version — reordering the
          // element among its siblings is the only way to bring an overlapping pin
          // to the front on tap.
          el.parentElement?.appendChild(el);
          const prevKey = activeKeyRef.current;
          if (prevKey && prevKey !== key) {
            const prevPin = markersRef.current.get(prevKey)?.getElement().querySelector<HTMLElement>(".crew-pin");
            if (prevPin) prevPin.style.transform = "scale(1)";
          }
          activeKeyRef.current = key;
          const pin = el.querySelector<HTMLElement>(".crew-pin");
          if (pin) pin.style.transform = "scale(1.08)";
          onSelectProposalRef.current(proposalsByIdRef.current.get(key) ?? p);
        });
        marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([p.lng, p.lat])
          .addTo(map);
        markersRef.current.set(key, marker);
      } else {
        marker.setLngLat([p.lng, p.lat]);
        marker.getElement().innerHTML = html;
        if (key === activeKeyRef.current) {
          const pin = marker.getElement().querySelector<HTMLElement>(".crew-pin");
          if (pin) pin.style.transform = "scale(1.08)";
        }
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
      el.innerHTML = draftPinHtml(currentUserRef.current || undefined);
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
