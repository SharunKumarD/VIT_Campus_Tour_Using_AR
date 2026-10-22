/**
 * Where the app gets its campus data.
 *
 * Today: the bundled, validated demo pack (works offline, ships in the APK).
 * Phase 7: a downloaded pack from IndexedDB, falling back to this bundled one.
 * Screens must only call getCampusPack(), never import the demo pack directly,
 * so swapping the source later touches one file.
 */

import { DEMO_CAMPUS_PACK } from "./demo-pack.ts";
import { parseCampusPack } from "./validate.ts";
import type { CampusPack, Poi } from "./types.ts";

let cached: CampusPack | null = null;

export function getCampusPack(): CampusPack {
  // Validate once at startup: a broken bundled pack should fail loudly in development.
  cached ??= parseCampusPack(DEMO_CAMPUS_PACK);
  return cached;
}

export function getPoi(id: string | null | undefined): Poi | undefined {
  if (!id) return undefined;
  return getCampusPack().pois.find((p) => p.id === id);
}

/** Default starting point until live location arrives in a later phase. */
export const DEFAULT_START_POI_ID = "poi-gate";
