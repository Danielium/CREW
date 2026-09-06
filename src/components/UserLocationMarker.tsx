"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";

export default function UserLocationMarker({
  map,
  onLocationFound,
  triggerLocate,
}: {
  map: maplibregl.Map | null;
  onLocationFound?: (latlng: [number, number]) => void;
  triggerLocate?: number;
}) {
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const hasFlownForTrigger = useRef(0);
  const onLocationFoundRef = useRef(onLocationFound);

  useEffect(() => {
    onLocationFoundRef.current = onLocationFound;
  }, [onLocationFound]);

  // Create the marker element once, detached until the first fix arrives.
  useEffect(() => {
    const el = document.createElement("div");
    el.style.width = "20px";
    el.style.height = "20px";
    el.style.position = "relative";
    el.innerHTML = `
      <div style="position:absolute;inset:0;border-radius:50%;background:rgba(204,255,0,0.3);"></div>
      <div style="position:absolute;top:4px;left:4px;width:12px;height:12px;border-radius:50%;background:#CCFF00;border:2px solid #FFFFFF;"></div>
    `;
    markerRef.current = new maplibregl.Marker({ element: el });
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
    };
  }, []);

  // On button press (triggerLocate > 0): request geo
  useEffect(() => {
    if (!triggerLocate || !map) return; // don't run on initial mount (triggerLocate = 0)

    let watchId: number | null = null;
    let tgInterval: NodeJS.Timeout | null = null;
    let settled = false; // prevent race: only the first source wins the flyTo

    const saveAndShow = (lat: number, lng: number) => {
      const coords: [number, number] = [lat, lng];
      markerRef.current?.setLngLat([lng, lat]).addTo(map);
      if (onLocationFoundRef.current) onLocationFoundRef.current(coords);

      // Only fly once per triggerLocate button press
      if (hasFlownForTrigger.current !== triggerLocate) {
        hasFlownForTrigger.current = triggerLocate;
        map.flyTo({ center: [lng, lat], zoom: 14, duration: 1000 });
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
      // Live updates
      startBrowserWatch();
    };

    const doLocate = async () => {
      // 1. Telegram LocationManager
      const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
      if (tg?.LocationManager) {
        const runTgGeo = () => {
          const fetchTg = () => {
            try {
              tg.LocationManager.getLocation((data: any) => {
                if (data && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
                  saveAndShow(data.latitude, data.longitude);
                  settled = true;
                }
              });
            } catch(e) {
              console.warn("TG Geo error:", e);
            }
          };

          fetchTg(); // Initial fetch
          // Poll every 5 seconds for live updates (TG doesn't have watchPosition)
          tgInterval = setInterval(fetchTg, 5000);
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
      if (tgInterval !== null) {
        clearInterval(tgInterval);
      }
    };
  }, [triggerLocate, map]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
