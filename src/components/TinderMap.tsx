"use client";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, CircleMarker, useMapEvents } from "react-leaflet";
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

function UserLocationMarker({ setInitialLocation }: { setInitialLocation: (latlng: [number, number]) => void }) {
  const [position, setPosition] = useState<[number, number] | null>(null);

  useEffect(() => {
    let watchId: number | null = null;
    let capWatchId: string | null = null;

    const handleLocation = (lat: number | string, lng: number | string) => {
      const numLat = Number(lat);
      const numLng = Number(lng);
      if (!isNaN(numLat) && !isNaN(numLng)) {
        setPosition([numLat, numLng]);
        setInitialLocation([numLat, numLng]);
      }
    };

    const startWatching = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          const { Geolocation } = await import('@capacitor/geolocation');
          const perm = await Geolocation.checkPermissions();
          if (perm.location !== 'granted') {
            await Geolocation.requestPermissions();
          }
          capWatchId = await Geolocation.watchPosition({ enableHighAccuracy: true }, (pos, err) => {
            if (pos) handleLocation(pos.coords.latitude, pos.coords.longitude);
          });
          return;
        }
      } catch (e) {
        console.error("Capacitor geolocation error:", e);
      }

      // Fallbacks
      const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
      if (tg?.LocationManager) {
        tg.LocationManager.init(() => {
          tg.LocationManager.getLocation((data: any) => {
            if (data) handleLocation(data.latitude, data.longitude);
          });
        });
      } else if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => handleLocation(pos.coords.latitude, pos.coords.longitude),
          () => {},
          { enableHighAccuracy: true }
        );
      }
    };

    startWatching();

    return () => {
      if (watchId && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (capWatchId) {
        import('@capacitor/geolocation').then(({ Geolocation }) => {
          Geolocation.clearWatch({ id: capWatchId as string });
        });
      }
    };
  }, []);

  if (!position) return null;

  return (
    <>
      <CircleMarker 
        center={position} 
        radius={10} 
        pathOptions={{ color: "#CCFF00", fillColor: "#CCFF00", fillOpacity: 0.3, weight: 1 }} 
      />
      <CircleMarker 
        center={position} 
        radius={6} 
        pathOptions={{ color: "#FFFFFF", fillColor: "#CCFF00", fillOpacity: 1, weight: 2 }} 
      />
    </>
  );
}

export default function TinderMap({ proposals, onSelectProposal, onMapClick, forceCenter }: { proposals: any[], onSelectProposal: (p: any) => void, onMapClick?: (latlng: any) => void, forceCenter?: [number, number] | null }) {
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);
  const [hasFlown, setHasFlown] = useState(false);

  const handleSetInitialLocation = (latlng: [number, number]) => {
    if (!hasFlown) {
      setInitialCenter(latlng);
      setHasFlown(true);
    }
  };

  return (
    <div className="w-full h-[100dvh] absolute top-0 left-0 z-0">
      <MapContainer
        center={[55.7558, 37.6173]}
        zoom={14}
        style={{ width: "100%", height: "100%" }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        
        <MapController onMapClick={onMapClick} forceCenter={forceCenter || initialCenter} />

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

        <UserLocationMarker setInitialLocation={handleSetInitialLocation} />
      </MapContainer>
    </div>
  );
}
