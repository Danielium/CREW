"use client";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon path issues in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Custom Crew Pin
const crewIcon = new L.DivIcon({
  html: `<div style="width: 24px; height: 24px; background: #CCFF00; border-radius: 50%; border: 3px solid #000; box-shadow: 0 0 10px rgba(204,255,0,0.5);"></div>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
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
      map.flyTo(forceCenter, 14, { duration: 1 });
    }
  }, [forceCenter, map]);

  return null;
}

export default function TinderMap({ proposals, onSelectProposal, onMapClick, forceCenter }: { proposals: any[], onSelectProposal: (p: any) => void, onMapClick?: (latlng: any) => void, forceCenter?: [number, number] | null }) {
  const [center, setCenter] = useState<[number, number]>([55.7558, 37.6173]);
  const [hasSetInitialLocation, setHasSetInitialLocation] = useState(false);

  // Request user location on mount
  useEffect(() => {
    const handleLocation = (lat: number, lng: number) => {
      if (!hasSetInitialLocation) {
        setCenter([lat, lng]);
        setHasSetInitialLocation(true);
      }
    };

    const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
    
    if (tg?.LocationManager) {
      tg.LocationManager.init(() => {
        tg.LocationManager.getLocation((data: any) => {
          if (data) handleLocation(data.latitude, data.longitude);
        });
      });
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => handleLocation(pos.coords.latitude, pos.coords.longitude),
        () => {}
      );
    }
  }, [hasSetInitialLocation]);

  return (
    <div className="w-full h-[100dvh] absolute top-0 left-0 z-0">
      <MapContainer
        center={center}
        zoom={14}
        style={{ width: "100%", height: "100%" }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        
        <MapController onMapClick={onMapClick} forceCenter={forceCenter || (hasSetInitialLocation ? center : null)} />

        {proposals.map(p => (
          <Marker 
            key={p.id} 
            position={[p.lat, p.lng]} 
            icon={crewIcon}
            eventHandlers={{
              click: () => onSelectProposal(p)
            }}
          />
        ))}
      </MapContainer>
    </div>
  );
}
