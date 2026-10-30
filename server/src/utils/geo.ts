// Exact 4-corner boundary coordinates provided by institution:
// q1 -> 15.774450196357801, 78.05467113649686
// q2 -> 15.774311503975998, 78.05457367411404
// q3 -> 15.774131902250424, 78.0547841514271
// q4 -> 15.774300528319552, 78.05484117730008

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface BoundaryCorner extends GeoPoint {
  id: string;
}

export const HOSTEL_BOUNDARY_POLYGON: BoundaryCorner[] = [
  { id: 'q1', lat: 15.774450196357801, lng: 78.05467113649686 },
  { id: 'q2', lat: 15.774311503975998, lng: 78.05457367411404 },
  { id: 'q3', lat: 15.774131902250424, lng: 78.0547841514271 },
  { id: 'q4', lat: 15.774300528319552, lng: 78.05484117730008 }
];

// Calculated centroid of the 4 boundary corners:
export const HOSTEL_CENTROID: GeoPoint = {
  lat: 15.774299,
  lng: 78.054718
};

// Strict geofence default radius in meters (furthest corner is 19.9m, with buffer = 35m)
export const HOSTEL_GEOFENCE_RADIUS_METERS = 35;

// Haversine formula to compute great-circle distance between two GPS coordinates in meters
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c * 10) / 10;
}

// Ray-casting algorithm to determine if GPS point is geometrically inside the 4-corner polygon
export function isPointInPolygon(
  lat: number,
  lng: number,
  polygon: GeoPoint[] = HOSTEL_BOUNDARY_POLYGON
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;
    const intersect = ((yi > lng) !== (yj > lng)) &&
      (lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Distance from point to line segment
function distToSegment(p: GeoPoint, v: GeoPoint, w: GeoPoint): number {
  const cosLat = Math.cos((p.lat * Math.PI) / 180);
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * cosLat;

  const px = (p.lng - v.lng) * mPerDegLng;
  const py = (p.lat - v.lat) * mPerDegLat;
  const wx = (w.lng - v.lng) * mPerDegLng;
  const wy = (w.lat - v.lat) * mPerDegLat;

  const l2 = wx * wx + wy * wy;
  if (l2 === 0) return Math.sqrt(px * px + py * py);
  let t = ((px * wx) + (py * wy)) / l2;
  t = Math.max(0, Math.min(1, t));
  const dx = px - (t * wx);
  const dy = py - (t * wy);
  return Math.sqrt(dx * dx + dy * dy);
}

// Returns 0 if inside the polygon; otherwise returns distance in meters to nearest edge
export function getDistanceToHostelPolygon(
  lat: number,
  lng: number,
  polygon: GeoPoint[] = HOSTEL_BOUNDARY_POLYGON
): number {
  if (isPointInPolygon(lat, lng, polygon)) {
    return 0;
  }
  let minDist = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const nextIdx = (i + 1) % polygon.length;
    const d = distToSegment({ lat, lng }, polygon[i], polygon[nextIdx]);
    if (d < minDist) minDist = d;
  }
  return Math.round(minDist * 10) / 10;
}

// Comprehensive strict verification helper
export function verifyHostelGeofence(
  lat: number,
  lng: number,
  maxAllowedRadiusMeters: number = HOSTEL_GEOFENCE_RADIUS_METERS
): {
  isInside: boolean;
  distanceMeters: number;
  inPolygon: boolean;
  reason?: string;
} {
  const inPolygon = isPointInPolygon(lat, lng, HOSTEL_BOUNDARY_POLYGON);
  if (inPolygon) {
    return {
      isInside: true,
      distanceMeters: 0,
      inPolygon: true
    };
  }

  const polyDist = getDistanceToHostelPolygon(lat, lng, HOSTEL_BOUNDARY_POLYGON);
  const centerDist = calculateDistanceMeters(lat, lng, HOSTEL_CENTROID.lat, HOSTEL_CENTROID.lng);

  // Accept if within indoor GPS jitter threshold (15m from perimeter or within maximum radius from center)
  const isInside = polyDist <= 15 || centerDist <= maxAllowedRadiusMeters;

  return {
    isInside,
    distanceMeters: polyDist,
    inPolygon: false,
    reason: isInside
      ? undefined
      : `Outside Hostel Geofence: Current location is ${polyDist}m outside the hostel perimeter. Attendance capture is strictly restricted to hostel grounds (q1-q4 boundary).`
  };
}
