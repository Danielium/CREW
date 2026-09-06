"use client";

import { useState, useRef, useEffect } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Search, MapPin, Loader2, LocateFixed } from "lucide-react";
import UserLocationMarker from "./UserLocationMarker";
import { MAP_STYLE_URL } from "@/lib/mapTiles";

type LatLng = { lat: number; lng: number };

interface MapRouteBuilderProps {
  onDistanceChange: (distance: string) => void;
  onRouteDataChange?: (routeData: string) => void;
  onAddressFound?: (address: string) => void;
  initialRouteData?: string | null;
}

function haversine(a: LatLng, b: LatLng) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const ROUTE_SOURCE_ID = "route-builder-segments";
const ROUTE_LAYER_ID = "route-builder-segments-line";

export default function MapRouteBuilder({ onDistanceChange, onRouteDataChange, onAddressFound, initialRouteData }: MapRouteBuilderProps) {
  const [waypoints, setWaypoints] = useState<LatLng[]>([]);
  const [segments, setSegments] = useState<LatLng[][]>([]);
  const [isRouting, setIsRouting] = useState(false);
  const [distance, setDistance] = useState("0.00");
  const [search, setSearch] = useState("");
  const [triggerLocate, setTriggerLocate] = useState(0);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [map, setMap] = useState<maplibregl.Map | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const startMarkerRef = useRef<maplibregl.Marker | null>(null);
  const endMarkerRef = useRef<maplibregl.Marker | null>(null);
  const waypointsRef = useRef<LatLng[]>([]);
  const segmentsRef = useRef<LatLng[][]>([]);
  const isRoutingRef = useRef(false);
  const styleLoadedRef = useRef(false);

  useEffect(() => { waypointsRef.current = waypoints; }, [waypoints]);
  useEffect(() => { segmentsRef.current = segments; }, [segments]);
  useEffect(() => { isRoutingRef.current = isRouting; }, [isRouting]);

  // Recompute distance/route whenever the route itself changes, and report it to the
  // parent from an effect (not from inside the click handler) — calling a parent's
  // setState synchronously from a maplibre click callback raced with React's own
  // render of this component and triggered "Cannot update a component while
  // rendering a different component"; an effect is the phase React guarantees is
  // safe for updating another component.
  useEffect(() => {
    let totalDist = 0;
    for (const segment of segments) {
      for (let i = 0; i < segment.length - 1; i++) {
        totalDist += haversine(segment[i], segment[i + 1]);
      }
    }
    const distStr = (totalDist / 1000).toFixed(2);
    setDistance(distStr);

    if (onDistanceChange) onDistanceChange(distStr);
    if (onRouteDataChange) {
      const flattened = segments.length === 0 ? waypoints : segments.flat();
      onRouteDataChange(JSON.stringify(flattened.map(p => ({ lat: p.lat, lng: p.lng }))));
    }
  }, [waypoints, segments]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMapClickRef = useRef<(latlng: LatLng) => void>(() => {});
  handleMapClickRef.current = async (newPoint: LatLng) => {
    if (isRoutingRef.current) return;

    const currentWaypoints = waypointsRef.current;

    if (currentWaypoints.length === 0) {
      setWaypoints([newPoint]);

      if (onAddressFound) {
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${newPoint.lat}&lon=${newPoint.lng}&accept-language=ru`)
          .then(res => res.json())
          .then(data => {
            if (data && data.address) {
              const a = data.address;
              const city = a.city || a.town || a.village || "";
              const road = a.road || "";
              const house = a.house_number || "";

              const parts = [];
              if (city) parts.push(city);
              if (road) parts.push(road);
              if (house) parts.push(house);

              if (parts.length > 0) {
                onAddressFound(parts.join(", "));
              } else {
                onAddressFound(data.display_name || "");
              }
            }
          })
          .catch(e => console.error("Address fetch error", e));
      }
      return;
    }

    setIsRouting(true);
    const lastPoint = currentWaypoints[currentWaypoints.length - 1];

    try {
      const res = await fetch(`https://router.project-osrm.org/route/v1/foot/${lastPoint.lng},${lastPoint.lat};${newPoint.lng},${newPoint.lat}?geometries=geojson`);
      const data = await res.json();

      let segmentCoords: LatLng[] = [];
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const coords = data.routes[0].geometry.coordinates; // [lon, lat][]
        segmentCoords = coords.map((c: number[]) => ({ lat: c[1], lng: c[0] }));
      } else {
        segmentCoords = [lastPoint, newPoint];
      }

      const newWaypoints = [...currentWaypoints, newPoint];
      const newSegments = [...segmentsRef.current, segmentCoords];
      setWaypoints(newWaypoints);
      setSegments(newSegments);

    } catch (err) {
      console.error(err);
      const newWaypoints = [...currentWaypoints, newPoint];
      const newSegments = [...segmentsRef.current, [lastPoint, newPoint]];
      setWaypoints(newWaypoints);
      setSegments(newSegments);
    } finally {
      setIsRouting(false);
    }
  };

  // Preload an existing route (edit mode).
  useEffect(() => {
    if (initialRouteData && initialRouteData !== "[]") {
      try {
        const parsed = JSON.parse(initialRouteData);
        if (parsed && parsed.length > 0) {
          const latLngs: LatLng[] = parsed.map((p: any) => ({ lat: p.lat, lng: p.lng }));
          setWaypoints([latLngs[0], latLngs[latLngs.length - 1]]);
          setSegments([latLngs]);
        }
      } catch (e) {
        console.error("Failed to parse initialRouteData", e);
      }
    }
  }, []);

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current) return;
    const defaultCenter: [number, number] = [37.618423, 55.751244]; // Moscow, [lng, lat]
    const instance = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: defaultCenter,
      zoom: 13,
      attributionControl: false,
    });
    instance.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    instance.on("click", (e: maplibregl.MapMouseEvent) => {
      handleMapClickRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });
    instance.on("load", () => {
      styleLoadedRef.current = true;
      instance.addSource(ROUTE_SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      instance.addLayer({
        id: ROUTE_LAYER_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#CCFF00", "line-width": 5, "line-opacity": 0.9 },
      });
    });
    mapRef.current = instance;
    setMap(instance);

    return () => {
      instance.remove();
      mapRef.current = null;
      setMap(null);
    };
  }, []);

  // Keep the polyline segments in sync.
  useEffect(() => {
    if (!map || !styleLoadedRef.current) return;
    const source = map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData({
      type: "FeatureCollection",
      features: segments.map(segment => ({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: segment.map(p => [p.lng, p.lat]) },
      })),
    });
  }, [segments, map]);

  // Keep the first/last waypoint markers in sync.
  useEffect(() => {
    if (!map) return;

    if (waypoints.length === 0) {
      startMarkerRef.current?.remove();
      startMarkerRef.current = null;
      endMarkerRef.current?.remove();
      endMarkerRef.current = null;
      return;
    }

    const start = waypoints[0];
    if (!startMarkerRef.current) {
      startMarkerRef.current = new maplibregl.Marker({ color: "#CCFF00" })
        .setLngLat([start.lng, start.lat])
        .addTo(map);
    } else {
      startMarkerRef.current.setLngLat([start.lng, start.lat]);
    }

    if (waypoints.length > 1) {
      const end = waypoints[waypoints.length - 1];
      if (!endMarkerRef.current) {
        endMarkerRef.current = new maplibregl.Marker({ color: "#CCFF00" }).setLngLat([end.lng, end.lat]).addTo(map);
      } else {
        endMarkerRef.current.setLngLat([end.lng, end.lat]);
      }
    } else {
      endMarkerRef.current?.remove();
      endMarkerRef.current = null;
    }
  }, [waypoints, map]);

  const handleUndo = () => {
    if (waypoints.length === 0) return;
    setWaypoints(prev => prev.slice(0, -1));
    setSegments(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setWaypoints([]);
    setSegments([]);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(search)}&accept-language=ru`);
      const data = await res.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        mapRef.current?.flyTo({ center: [parseFloat(lon), parseFloat(lat)], zoom: 14 });
      } else {
        alert("Адрес не найден");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLocate = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (userLocation && mapRef.current) {
      mapRef.current.flyTo({ center: [userLocation[1], userLocation[0]], zoom: 14 });
    } else {
      setTriggerLocate(prev => prev + 1);
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex justify-between items-end">
        <label className="text-[10px] font-bold text-muted uppercase tracking-widest pl-4">Маршрут (Кликайте по карте)</label>
        <div className="flex gap-2 items-center">
          {isRouting && <span className="text-[10px] text-primary font-bold uppercase animate-pulse pr-2">Строим...</span>}
          {waypoints.length > 0 && (
            <button type="button" onClick={handleUndo} className="text-[10px] text-muted hover:text-foreground font-bold uppercase transition-colors" disabled={isRouting}>Отменить точку</button>
          )}
          {waypoints.length > 1 && (
            <button type="button" onClick={handleClear} className="text-[10px] text-red-500 hover:text-red-400 font-bold uppercase transition-colors" disabled={isRouting}>Очистить</button>
          )}
        </div>
      </div>

      {/* Search & Tools */}
      <div className="flex gap-2 relative z-10">
        <div
          className="flex-1 bg-card border border-border rounded-xl flex items-center px-3 gap-2 focus-within:border-primary transition-colors h-10"
        >
          <Search size={16} className="text-muted" />
          <input
            type="search"
            placeholder="Найти адрес..."
            className="bg-transparent border-none outline-none w-full text-xs font-medium"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch(e as any);
              }
            }}
          />
          {isSearching && <Loader2 size={14} className="animate-spin text-primary" />}
        </div>
        <button
          type="button"
          onClick={handleLocate}
          className="w-10 h-10 bg-card border border-border rounded-xl flex items-center justify-center text-primary hover:border-primary transition-colors flex-shrink-0"
        >
          <LocateFixed size={18} />
        </button>
      </div>

      <div className="w-full h-[350px] rounded-[24px] overflow-hidden border border-border relative z-0 shadow-lg">
        <div ref={containerRef} className="w-full h-full" />
        <UserLocationMarker map={map} triggerLocate={triggerLocate} onLocationFound={(loc) => setUserLocation(loc)} />

        {/* Distance overlay */}
        <div className="absolute bottom-4 left-4 z-[400] bg-background/95 backdrop-blur-md border border-border px-5 py-3 rounded-[20px] shadow-[0_0_20px_rgba(0,0,0,0.5)] flex flex-col pointer-events-none">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Дистанция</span>
          <span className="text-2xl font-black font-mono leading-none text-primary">{distance} <span className="text-xs text-foreground font-sans">КМ</span></span>
        </div>
      </div>
    </div>
  );
}
