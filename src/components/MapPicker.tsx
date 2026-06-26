"use client";
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
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

function LocationPicker({ position, setPosition }: { position: [number, number], setPosition: (p: [number, number]) => void }) {
  const map = useMapEvents({
    click(e: any) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });
  
  useEffect(() => {
    map.invalidateSize();
  }, [map]);

  return position ? <Marker position={position} icon={crewIcon} /> : null;
}

export default function MapPicker({ position, setPosition }: { position: [number, number], setPosition: (p: [number, number]) => void }) {
  return (
    <MapContainer center={position} zoom={14} style={{ width: "100%", height: "100%" }} zoomControl={false} attributionControl={false}>
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
      <LocationPicker position={position} setPosition={setPosition} />
    </MapContainer>
  );
}
