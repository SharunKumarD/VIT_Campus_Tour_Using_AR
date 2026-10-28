/**
 * Great-circle helpers for outdoor guidance to a landmark.
 * Pure functions: no browser APIs, unit-tested in tests/landmarks.test.ts.
 */

const R = 6_371_008.8; // mean Earth radius, metres
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export interface LatLng { lat: number; lng: number }

/** Haversine distance in metres. */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from a to b, degrees clockwise from true north, 0–359.99. */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Normalise any angle to (-180, 180]. */
export function wrap180(d: number): number {
  const x = ((d % 360) + 360) % 360;
  return x > 180 ? x - 360 : x;
}

/** Arrow rotation on screen: where the target is relative to where the phone points. */
export function relativeBearing(bearing: number, heading: number): number {
  return wrap180(bearing - heading);
}

/**
 * Next continuous rotation for a CSS transform, so 359° → 1° turns 2°, not -358°.
 */
export function unwrapRotation(previous: number, targetDeg: number): number {
  return previous + wrap180(targetDeg - previous);
}

/** Arrived when within this many metres, never tighter than the GPS accuracy allows. */
export function arrivalRadiusM(accuracyM: number): number {
  return Math.max(15, Math.min(40, Number.isFinite(accuracyM) ? accuracyM : 40));
}

export function compassWord(d: number): string {
  const words = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
  return words[Math.round((((d % 360) + 360) % 360) / 45) % 8];
}

export function formatMetres(m: number): string {
  if (m < 1000) return `${Math.round(m / 5) * 5} m`;
  return `${(m / 1000).toFixed(1)} km`;
}
