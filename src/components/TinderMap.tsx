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

function MapEventsHandler({ setCenter, fetchProposals }: any) {
  const map = useMapEvents({
    moveend: () => {
      setCenter(map.getCenter());
      // In a real app, we'd fetch proposals based on map bounds here
    }
  });
  
  useEffect(() => {
    map.invalidateSize();
  }, [map]);

  return null;
}

export default function TinderMap({ proposals, onSelectProposal }: { proposals: any[], onSelectProposal: (p: any) => void }) {
  const [center, setCenter] = useState<[number, number]>([55.7558, 37.6173]);

  // Request user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCenter([pos.coords.latitude, pos.coords.longitude]),
        () => {}
      );
    }
  }, []);

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
        
        <MapEventsHandler setCenter={setCenter} />

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
