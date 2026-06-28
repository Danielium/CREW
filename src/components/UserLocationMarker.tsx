"use client";

import { useEffect, useState } from "react";
import { useMap, CircleMarker } from "react-leaflet";

export default function UserLocationMarker({ 
  onLocationFound, 
  triggerLocate 
}: { 
  onLocationFound?: (latlng: [number, number]) => void;
  triggerLocate?: number;
}) {
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
    if (position && onLocationFound) {
      onLocationFound(position);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // On button press (triggerLocate > 0): request geo
  useEffect(() => {
    if (!triggerLocate) return; // don't run on initial mount (triggerLocate = 0)

    let watchId: number | null = null;

    const saveAndShow = (lat: number, lng: number) => {
      const coords: [number, number] = [lat, lng];
      setPosition(coords);
      if (onLocationFound) onLocationFound(coords);
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
