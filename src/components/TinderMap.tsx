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

export default function TinderMap({ proposals, onSelectProposal, onMapClick, forceCenter }: { proposals: any[], onSelectProposal: (p: any) => void, onMapClick?: (latlng: any) => void, forceCenter?: [number, number] | null }) {
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
