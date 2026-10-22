/**
 * Geometry helpers for the campus frame.
 *
 * Campus frame = local east-north plane in metres around the pack origin.
 * We use an equirectangular approximation. Over a campus a few kilometres
 * across, its error is far below consumer GPS error (several metres),
 * so it is adequate for routing and map display. It is NOT used for AR
 * anchoring when ARCore Geospatial is available (ARCore converts lat/lng itself).
 */

const EARTH_RADIUS_M = 6_371_008.8;
const DEG = Math.PI / 180;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface XY {
  x: number;
  y: number;
}

/** Campus (x east, y north, metres) -> WGS84. */
export function campusToLatLng(origin: LatLng, p: XY): LatLng {
  const lat = origin.lat + (p.y / EARTH_RADIUS_M) / DEG;
  const lng = origin.lng + (p.x / (EARTH_RADIUS_M * Math.cos(origin.lat * DEG))) / DEG;
  return { lat, lng };
}

/** WGS84 -> campus (x east, y north, metres). */
export function latLngToCampus(origin: LatLng, p: LatLng): XY {
  const y = (p.lat - origin.lat) * DEG * EARTH_RADIUS_M;
  const x = (p.lng - origin.lng) * DEG * EARTH_RADIUS_M * Math.cos(origin.lat * DEG);
  return { x, y };
}

/** Straight-line horizontal distance in metres. */
export function distance(a: XY, b: XY): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Compass bearing from a to b in degrees, 0 = north, 90 = east.
 * Returns NaN if the points coincide (e.g. both ends of a lift).
 */
export function bearing(a: XY, b: XY): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return Number.NaN;
  const deg = Math.atan2(dx, dy) / DEG;
  return (deg + 360) % 360;
}

/** Signed smallest turn from heading h1 to h2, in (-180, 180]. Positive = right. */
export function turnAngle(h1: number, h2: number): number {
  let d = (h2 - h1) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}
