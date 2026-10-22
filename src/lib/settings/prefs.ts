/**
 * User accessibility preferences and their mapping to a routing profile.
 *
 * Stored on the device only (small settings → localStorage is fine; campus
 * data will go to IndexedDB in Phase 7). Stored values are untrusted:
 * `parsePrefs` falls back to defaults for anything malformed.
 */

import { DEFAULT_PROFILE, STEP_FREE_PROFILE, type RouteProfile } from "../routing/profile.ts";

export interface Prefs {
  stepFree: boolean;
  avoidUnpaved: boolean;
  preferCovered: boolean;
  /** Slower walking speed for time estimates. */
  slowerPace: boolean;
  /**
   * Research comparison condition only: keep AR arrows visible even when
   * positioning is unreliable ("always-on AR" baseline). Off by default.
   */
  alwaysOnAr: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  stepFree: false,
  avoidUnpaved: false,
  preferCovered: false,
  slowerPace: false,
  alwaysOnAr: false,
};

export const PREFS_STORAGE_KEY = "vitiar.prefs.v1";

export function parsePrefs(raw: unknown): Prefs {
  let v: unknown = raw;
  if (typeof raw === "string") {
    try {
      v = JSON.parse(raw);
    } catch {
      return { ...DEFAULT_PREFS };
    }
  }
  if (typeof v !== "object" || v === null) return { ...DEFAULT_PREFS };
  const o = v as Record<string, unknown>;
  const bool = (k: keyof Prefs) => (typeof o[k] === "boolean" ? (o[k] as boolean) : DEFAULT_PREFS[k]);
  return {
    stepFree: bool("stepFree"),
    avoidUnpaved: bool("avoidUnpaved"),
    preferCovered: bool("preferCovered"),
    slowerPace: bool("slowerPace"),
    alwaysOnAr: bool("alwaysOnAr"),
  };
}

export function profileFromPrefs(p: Prefs): RouteProfile {
  const base = p.stepFree ? STEP_FREE_PROFILE : DEFAULT_PROFILE;
  return {
    ...base,
    avoidUnpaved: p.avoidUnpaved,
    preferCovered: p.preferCovered,
    walkingSpeedMps: p.slowerPace ? Math.min(base.walkingSpeedMps ?? 1.2, 0.8) : base.walkingSpeedMps,
  };
}

/** "6 min", "1 h 5 min"; never "0 min" for a non-zero route. */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0 min";
  const min = Math.max(1, Math.round(seconds / 60));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}
