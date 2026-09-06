type LatLng = { lat: number; lng: number };

const LOOP_THRESHOLD_METERS = 20;

function haversine(a: LatLng, b: LatLng) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// A route counts as a loop only with 3+ points — two clicks landing close together
// is just an imprecise tap, not an intentional closed route.
export function isLoopRoute(points: LatLng[]): boolean {
  if (points.length < 3) return false;
  return haversine(points[0], points[points.length - 1]) < LOOP_THRESHOLD_METERS;
}
