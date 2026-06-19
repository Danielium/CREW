"use client";
import { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Helper component to center map on current position and invalidate size
function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  
  useEffect(() => {
    // Invalidate map size once to ensure it fills container correctly when map modal mounts
    map.invalidateSize();
  }, [map]);

  useEffect(() => {
    // Center the map when coordinates change
    map.setView(center);
  }, [center, map]);
  
  return null;
}

interface LiveRunMapProps {
  route: { lat: number; lng: number }[];
  currentPosition: { lat: number; lng: number } | null;
}

export default function LiveRunMap({ route, currentPosition }: LiveRunMapProps) {
  // Default coordinate (Moscow) if no currentPosition
  const defaultCenter: [number, number] = [55.7558, 37.6173];
  const center: [number, number] = currentPosition 
    ? [currentPosition.lat, currentPosition.lng] 
    : defaultCenter;

  const positions: L.LatLngTuple[] = route.map(p => [p.lat, p.lng]);

  return (
    <div className="w-full h-full relative rounded-[24px] overflow-hidden border border-border">
      <MapContainer
        center={center}
        zoom={16}
        style={{ width: "100%", height: "100%" }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        
        {positions.length > 1 && (
          <Polyline positions={positions} color="#CCFF00" weight={5} opacity={0.9} />
        )}
        
        <MapRecenter center={center} />

        {currentPosition && (
          <>
            {/* Position outer ring */}
            <CircleMarker 
              center={center} 
              radius={10} 
              pathOptions={{ 
                color: "#CCFF00", 
                fillColor: "#CCFF00", 
                fillOpacity: 0.3, 
                weight: 1 
              }} 
            />
            {/* Position center dot */}
            <CircleMarker 
              center={center} 
              radius={6} 
              pathOptions={{ 
                color: "#FFFFFF", 
                fillColor: "#CCFF00", 
                fillOpacity: 1, 
                weight: 2 
              }} 
            />
          </>
        )}
      </MapContainer>
    </div>
  );
}
