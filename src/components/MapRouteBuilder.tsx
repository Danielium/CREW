"use client";

import { useState, useRef, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search, MapPin, Loader2, LocateFixed } from "lucide-react";
import UserLocationMarker from "./UserLocationMarker";

// Fix default icons in leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface MapRouteBuilderProps {
  onDistanceChange: (distance: string) => void;
  onRouteDataChange?: (routeData: string) => void;
  onAddressFound?: (address: string) => void;
  initialRouteData?: string | null;
}

function MapController({ 
  searchQuery, 
}: { 
  searchQuery: string | null; 
}) {
  const map = useMap();

  if (searchQuery) {
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          const { lat, lon } = data[0];
          map.flyTo([parseFloat(lat), parseFloat(lon)], 14);
        }
      });
  }

  return null;
}

function RouteEvents({ 
  onMapClick 
}: { 
  onMapClick: (e: L.LeafletMouseEvent, map: L.Map) => void 
}) {
  const map = useMapEvents({
    click(e) {
      onMapClick(e, map);
    }
  });
  return null;
}

export default function MapRouteBuilder({ onDistanceChange, onRouteDataChange, onAddressFound, initialRouteData }: MapRouteBuilderProps) {
  const [waypoints, setWaypoints] = useState<L.LatLng[]>([]);
  const [segments, setSegments] = useState<L.LatLng[][]>([]);
  const [isRouting, setIsRouting] = useState(false);
  const [distance, setDistance] = useState("0.00");
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState<string | null>(null);
  const [triggerLocate, setTriggerLocate] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (initialRouteData && initialRouteData !== "[]") {
      try {
        const parsed = JSON.parse(initialRouteData);
        if (parsed && parsed.length > 0) {
          const latLngs = parsed.map((p: any) => L.latLng(p.lat, p.lng));
          // If we have just points without actual waypoints, we can just treat the first and last as waypoints,
          // and the whole array as one segment.
          setWaypoints([latLngs[0], latLngs[latLngs.length - 1]]);
          setSegments([latLngs]);
          // Note: map distance calculation will happen on the first manual action or we can trigger it
        }
      } catch (e) {
        console.error("Failed to parse initialRouteData", e);
      }
    }
  }, []);

  const updateDistanceAndRoute = (wps: L.LatLng[], segs: L.LatLng[][], map: L.Map | null = mapRef.current) => {
    if (!map) return;
    
    let totalDist = 0;
    for (const segment of segs) {
      for (let i = 0; i < segment.length - 1; i++) {
        totalDist += map.distance(segment[i], segment[i+1]);
      }
    }
    const distStr = (totalDist / 1000).toFixed(2);
    setDistance(distStr);
    
    // Pass to parent
    if (onDistanceChange) onDistanceChange(distStr);
    if (onRouteDataChange) {
      let flattened: L.LatLng[] = [];
      if (segs.length === 0) {
         flattened = wps;
      } else {
         flattened = segs.flat();
      }
      onRouteDataChange(JSON.stringify(flattened.map(p => ({ lat: p.lat, lng: p.lng }))));
    }
  };

  const handleMapClick = async (e: L.LeafletMouseEvent, map: L.Map) => {
    if (isRouting) return;

    const newPoint = e.latlng;
    
    if (waypoints.length === 0) {
      setWaypoints([newPoint]);
      updateDistanceAndRoute([newPoint], [], map);
      
      if (onAddressFound) {
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${newPoint.lat}&lon=${newPoint.lng}&accept-language=ru`)
          .then(res => res.json())
          .then(data => {
            if (data && data.address) {
              const road = data.address.road || "";
              const house = data.address.house_number || "";
              if (road) {
                onAddressFound(`${road}${house ? `, ${house}` : ''}`);
              } else {
                onAddressFound(data.display_name?.split(',')[0] || "");
              }
            }
          })
          .catch(e => console.error("Address fetch error", e));
      }
      return;
    }

    setIsRouting(true);
    const lastPoint = waypoints[waypoints.length - 1];
    
    try {
      const res = await fetch(`https://router.project-osrm.org/route/v1/foot/${lastPoint.lng},${lastPoint.lat};${newPoint.lng},${newPoint.lat}?geometries=geojson`);
      const data = await res.json();
      
      let segmentCoords: L.LatLng[] = [];
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const coords = data.routes[0].geometry.coordinates; // [lon, lat][]
        segmentCoords = coords.map((c: number[]) => L.latLng(c[1], c[0]));
      } else {
        segmentCoords = [lastPoint, newPoint];
      }

      const newWaypoints = [...waypoints, newPoint];
      const newSegments = [...segments, segmentCoords];
      
      setWaypoints(newWaypoints);
      setSegments(newSegments);
      updateDistanceAndRoute(newWaypoints, newSegments, map);

    } catch (err) {
      console.error(err);
      const newWaypoints = [...waypoints, newPoint];
      const newSegments = [...segments, [lastPoint, newPoint]];
      setWaypoints(newWaypoints);
      setSegments(newSegments);
      updateDistanceAndRoute(newWaypoints, newSegments, map);
    } finally {
      setIsRouting(false);
    }
  };

  const handleUndo = () => {
    if (waypoints.length === 0) return;
    const newWaypoints = waypoints.slice(0, -1);
    const newSegments = segments.slice(0, -1);
    setWaypoints(newWaypoints);
    setSegments(newSegments);
    updateDistanceAndRoute(newWaypoints, newSegments);
  };

  const handleClear = () => {
    setWaypoints([]);
    setSegments([]);
    setDistance("0.00");
    onDistanceChange("0.00");
    if (onRouteDataChange) onRouteDataChange("[]");
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
        if (mapRef.current) {
          mapRef.current.flyTo([parseFloat(lat), parseFloat(lon)], 14);
        }
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
    setTriggerLocate(prev => prev + 1);
  };

  // Default center (Moscow)
  const defaultCenter: L.LatLngTuple = [55.751244, 37.618423];

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
        <form 
          onSubmit={handleSearch} 
          className="flex-1 bg-card border border-border rounded-xl flex items-center px-3 gap-2 focus-within:border-primary transition-colors h-10"
        >
          <Search size={16} className="text-muted" />
          <input 
            type="search" 
            placeholder="Найти адрес..." 
            className="bg-transparent border-none outline-none w-full text-xs font-medium"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {isSearching && <Loader2 size={14} className="animate-spin text-primary" />}
        </form>
        <button 
          type="button" 
          onClick={handleLocate}
          className="w-10 h-10 bg-card border border-border rounded-xl flex items-center justify-center text-primary hover:border-primary transition-colors flex-shrink-0"
        >
          <LocateFixed size={18} />
        </button>
      </div>
      
      <div className="w-full h-[350px] rounded-[24px] overflow-hidden border border-border relative z-0 shadow-lg">
        <MapContainer 
          center={defaultCenter} 
          zoom={13} 
          style={{ width: '100%', height: '100%' }} 
          zoomControl={false}
          attributionControl={false}
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          
          <UserLocationMarker triggerLocate={triggerLocate} />
          
          <RouteEvents 
            onMapClick={handleMapClick} 
          />
          
          {waypoints.length > 0 && (
            <Marker position={waypoints[0]} opacity={0.8} />
          )}
          {waypoints.length > 1 && (
            <Marker position={waypoints[waypoints.length - 1]} />
          )}
          
          {segments.map((segment, idx) => (
            <Polyline key={idx} positions={segment} color="#CCFF00" weight={5} opacity={0.9} />
          ))}
        </MapContainer>
        
        {/* Distance overlay */}
        <div className="absolute bottom-4 left-4 z-[400] bg-background/95 backdrop-blur-md border border-border px-5 py-3 rounded-[20px] shadow-[0_0_20px_rgba(0,0,0,0.5)] flex flex-col pointer-events-none">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Дистанция</span>
          <span className="text-2xl font-black font-mono leading-none text-primary">{distance} <span className="text-xs text-foreground font-sans">КМ</span></span>
        </div>
      </div>
    </div>
  );
}
