/**
 * Turning a GPS fix into something the app can use — honestly.
 *
 * Phone GPS is typically good to several metres in the open and much worse
 * near buildings and under trees; indoors it cannot tell floors apart. So:
 *   - every fix is classified by its reported accuracy,
 *   - it is only snapped to OUTDOOR route nodes,
 *   - and "start from my location" is only offered when the fix is good
 *     enough and actually on the mapped campus.
 */

import type { CampusPack, NavNode } from "../campus/types.ts";
import { latLngToCampus, type XY } from "../routing/geo.ts";
import { nearestNode } from "../routing/route.ts";

export interface Fix {
  lat: number;
  lng: number;
  /** Reported horizontal accuracy radius in metres (68% confidence on Android). */
  accuracyM: number;
  timestamp: number;
  headingDeg?: number | null;
}

export type FixQuality = "good" | "fair" | "poor";

/** Thresholds are starting values for the field study. */
export const GOOD_ACCURACY_M = 10;
export const FAIR_ACCURACY_M = 25;
export const STALE_AFTER_MS = 30_000;
/** How far outside the mapped area a fix still counts as "on campus". */
export const CAMPUS_MARGIN_M = 150;

export function classifyAccuracy(accuracyM: number): FixQuality {
  if (!Number.isFinite(accuracyM) || accuracyM < 0) return "poor";
  if (accuracyM <= GOOD_ACCURACY_M) return "good";
  if (accuracyM <= FAIR_ACCURACY_M) return "fair";
  return "poor";
}

export function isStale(fix: Fix, nowMs: number): boolean {
  return nowMs - fix.timestamp > STALE_AFTER_MS;
}

export interface Located {
  campus: XY;
  quality: FixQuality;
  /** Distance from the edge of the mapped area (0 if inside it). */
  distanceFromMapM: number;
  onCampus: boolean;
  nearest: { node: NavNode; distanceM: number } | null;
  /** True if routing may start from the nearest node. */
  canStartHere: boolean;
}

export function campusBounds(pack: CampusPack) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of pack.nodes) {
    minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
  }
  return { minX, maxX, minY, maxY };
}

export function locate(pack: CampusPack, fix: Fix): Located {
  const campus = latLngToCampus(pack.origin, fix);
  const b = campusBounds(pack);
  const dx = Math.max(b.minX - campus.x, 0, campus.x - b.maxX);
  const dy = Math.max(b.minY - campus.y, 0, campus.y - b.maxY);
  const distanceFromMapM = Math.hypot(dx, dy);
  const onCampus = distanceFromMapM <= CAMPUS_MARGIN_M;
  const quality = classifyAccuracy(fix.accuracyM);
  const nearest = onCampus ? nearestNode(pack, campus, { outdoorOnly: true }) : null;
  const canStartHere =
    onCampus && quality !== "poor" && nearest !== null && nearest.distanceM <= Math.max(25, fix.accuracyM);
  return { campus, quality, distanceFromMapM, onCampus, nearest, canStartHere };
}

export function describeFix(l: Located, accuracyM: number): string {
  const acc = `about ${Math.round(accuracyM)} m`;
  if (!l.onCampus) {
    const km = l.distanceFromMapM / 1000;
    return `You are ${km >= 1 ? `${km.toFixed(1)} km` : `${Math.round(l.distanceFromMapM)} m`} from the mapped campus.`;
  }
  if (l.quality === "poor") return `Location is too rough to route from (${acc}). Move into the open or choose a start place.`;
  return `Location accurate to ${acc}.`;
}
