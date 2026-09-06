"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_STYLE_URL } from "@/lib/mapTiles";
import { isLoopRoute } from "@/lib/routeLoop";

interface RunRouteMapProps {
  routeData: string; // JSON stringified array of {lat, lng}
}

export default function RunRouteMap({ routeData }: RunRouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

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
    points = [];
  }

  const hasRoute = points && points.length >= 2;

  useEffect(() => {
    if (!hasRoute || !containerRef.current) return;

    const coords: [number, number][] = points.map((p) => [p.lng, p.lat]);
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ];

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      bounds,
      fitBoundsOptions: { padding: 30 },
      attributionControl: false,
      interactive: false,
    });

    map.on("load", () => {
      map.addSource("route", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#CCFF00", "line-width": 4, "line-opacity": 0.9 },
      });

      const startEl = document.createElement("div");
      startEl.style.cssText = "width:14px;height:14px;border-radius:50%;background:#000;border:3px solid #CCFF00;";

      const loop = isLoopRoute(points);
      if (loop) {
        // Start and finish coincide — one marker, with a small red badge standing
        // in for the finish dot instead of drawing a second marker on top of it.
        const wrap = document.createElement("div");
        wrap.style.cssText = "position:relative;width:14px;height:14px;";
        wrap.appendChild(startEl);
        const badge = document.createElement("div");
        badge.style.cssText = "position:absolute;top:-2px;right:-2px;width:8px;height:8px;border-radius:50%;background:#FF4444;border:1.5px solid #000;";
        wrap.appendChild(badge);
        new maplibregl.Marker({ element: wrap }).setLngLat(coords[0]).addTo(map);
      } else {
        new maplibregl.Marker({ element: startEl }).setLngLat(coords[0]).addTo(map);

        const endEl = document.createElement("div");
        endEl.style.cssText = "width:14px;height:14px;border-radius:50%;background:#FF4444;border:2px solid #FF4444;";
        new maplibregl.Marker({ element: endEl }).setLngLat(coords[coords.length - 1]).addTo(map);
      }
    });

    return () => map.remove();
  }, [routeData]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasRoute) return null;

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
