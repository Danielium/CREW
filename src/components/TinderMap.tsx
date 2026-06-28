"use client";
import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, CircleMarker, useMapEvents, useMap } from "react-leaflet";
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

function UserLocationMarker({ setInitialLocation, triggerLocate }: { setInitialLocation: (latlng: [number, number]) => void, triggerLocate?: number }) {
  const [position, setPosition] = useState<[number, number] | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('lastKnownLocation');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.length === 2) return [parsed[0], parsed[1]];
        }
      } catch(e) {}
    }
    return null;
  });
  const map = useMap();

  // On mount: just notify parent about cached location (no geo request)
  useEffect(() => {
    if (position) {
      setInitialLocation(position);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // On button press (triggerLocate > 0): request geo
  useEffect(() => {
    if (!triggerLocate) return; // don't run on initial mount (triggerLocate = 0)

    let watchId: number | null = null;

    const saveAndShow = (lat: number, lng: number) => {
      const coords: [number, number] = [lat, lng];
      setPosition(coords);
      setInitialLocation(coords);
      try { localStorage.setItem('lastKnownLocation', JSON.stringify(coords)); } catch(e) {}
      map.flyTo(coords, 14, { duration: 1 });
    };

    const requestBrowserGeo = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => saveAndShow(pos.coords.latitude, pos.coords.longitude),
        (err) => console.warn("Geo error:", err.code),
        { enableHighAccuracy: true, timeout: 10000 }
      );
      // Start watching for live updates (won't prompt again if permission already granted)
      watchId = navigator.geolocation.watchPosition(
        (pos) => saveAndShow(pos.coords.latitude, pos.coords.longitude),
        () => {},
        { enableHighAccuracy: true }
      );
    };

    const doLocate = async () => {
      // 1. Telegram LocationManager
      const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
      if (tg?.LocationManager) {
        const runTgGeo = () => {
          tg.LocationManager.getLocation((data: any) => {
            if (data) {
              saveAndShow(data.latitude, data.longitude);
              // After TG gave us location, start browser watch for live updates
              requestBrowserGeo();
            } else {
              requestBrowserGeo();
            }
          });
        };
        if (!tg.LocationManager.isInited) {
          tg.LocationManager.init(() => runTgGeo());
        } else {
          runTgGeo();
        }
        return;
      }

      // 2. Browser geolocation (might prompt first time, silent after)
      requestBrowserGeo();
    };

    doLocate();

    return () => {
      if (watchId && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [triggerLocate]);

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

        <UserLocationMarker setInitialLocation={handleSetInitialLocation} triggerLocate={triggerLocate} />
      </MapContainer>
    </div>
  );
}
