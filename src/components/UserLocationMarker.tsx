"use client";

import { useEffect, useState, useRef } from "react";
import { useMap, CircleMarker } from "react-leaflet";

export default function UserLocationMarker({ 
  onLocationFound, 
  triggerLocate 
}: { 
  onLocationFound?: (latlng: [number, number]) => void;
  triggerLocate?: number;
}) {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const map = useMap();
  const hasFlownForTrigger = useRef(0);

  // On button press (triggerLocate > 0): request geo
  useEffect(() => {
    if (!triggerLocate) return; // don't run on initial mount (triggerLocate = 0)

    let watchId: number | null = null;
    let settled = false; // prevent race: only the first source wins the flyTo

    const saveAndShow = (lat: number, lng: number) => {
      const coords: [number, number] = [lat, lng];
      setPosition(coords);
      if (onLocationFound) onLocationFound(coords);

      // Only fly once per triggerLocate button press
      if (hasFlownForTrigger.current !== triggerLocate) {
        hasFlownForTrigger.current = triggerLocate;
        map.flyTo(coords, 14, { duration: 1 });
      }
    };

    // Start continuous browser watch (live updates, no duplicate initial request)
    const startBrowserWatch = () => {
      if (!navigator.geolocation) return;
      watchId = navigator.geolocation.watchPosition(
        (pos) => saveAndShow(pos.coords.latitude, pos.coords.longitude),
        (err) => { console.warn("Geo watch error:", err.code); },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    };

    // Full browser geo: one-shot for fast first fix + then watch for live updates
    const requestBrowserGeo = () => {
      if (!navigator.geolocation) return;
      // Quick first fix
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!settled) {
            settled = true;
            saveAndShow(pos.coords.latitude, pos.coords.longitude);
          }
        },
        (err) => { console.warn("Geo error:", err.code); },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      // Live updates (watchPosition doesn't need getCurrentPosition prefix when we already have one)
      startBrowserWatch();
    };

    const doLocate = async () => {
      // 1. Telegram LocationManager
      const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
      if (tg?.LocationManager) {
        const runTgGeo = () => {
          let tgResolved = false;
          const fallbackTimeout = setTimeout(() => {
            if (!tgResolved) {
              tgResolved = true;
              requestBrowserGeo();
            }
          }, 3000);

          try {
            tg.LocationManager.getLocation((data: any) => {
              if (tgResolved) return;
              tgResolved = true;
              clearTimeout(fallbackTimeout);

              if (data && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
                // TG gave us a position — use it, then start watch-only for live updates
                saveAndShow(data.latitude, data.longitude);
                settled = true;
                startBrowserWatch(); // only watch, no duplicate getCurrentPosition
              } else {
                // TG failed — fall back to full browser geo
                requestBrowserGeo();
              }
            });
          } catch(e) {
            if (!tgResolved) {
              tgResolved = true;
              clearTimeout(fallbackTimeout);
              requestBrowserGeo();
            }
          }
        };

        if (!tg.LocationManager.isInited) {
          try {
            tg.LocationManager.init(() => runTgGeo());
          } catch(e) {
            requestBrowserGeo();
          }
        } else {
          runTgGeo();
        }
        return;
      }

      // 2. Browser geolocation fallback
      requestBrowserGeo();
    };

    doLocate();

    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [triggerLocate]); // eslint-disable-line react-hooks/exhaustive-deps

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
