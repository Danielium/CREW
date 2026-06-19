"use client";

import { MapContainer, TileLayer, Polyline, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface RunRouteMapProps {
  routeData: string; // JSON stringified array of {lat, lng}
}

export default function RunRouteMap({ routeData }: RunRouteMapProps) {
  let points: any[] = [];
  try {
    let parsed = JSON.parse(routeData);
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed); // Handle legacy double-stringified data
    }
    if (Array.isArray(parsed)) {
      points = parsed;
    }
  } catch {
    return null;
  }

  if (!points || points.length < 2) return null;

  const positions: L.LatLngTuple[] = points.map((p) => [p.lat, p.lng]);

  // Calculate bounds to fit the route
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const bounds: L.LatLngBoundsExpression = [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];

  return (
    <MapContainer
      bounds={bounds}
      boundsOptions={{ padding: [30, 30] }}
      style={{ width: "100%", height: "100%" }}
      zoomControl={false}
      scrollWheelZoom={false}
      dragging={false}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
      <Polyline positions={positions} color="#CCFF00" weight={4} opacity={0.9} />
      {/* Start marker */}
      <CircleMarker center={positions[0]} radius={6} pathOptions={{ color: "#CCFF00", fillColor: "#000", fillOpacity: 1, weight: 3 }} />
      {/* End marker */}
      <CircleMarker center={positions[positions.length - 1]} radius={6} pathOptions={{ color: "#FF4444", fillColor: "#FF4444", fillOpacity: 1, weight: 2 }} />
    </MapContainer>
  );
}
