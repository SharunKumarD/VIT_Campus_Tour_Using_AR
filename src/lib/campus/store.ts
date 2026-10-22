/**
 * The single source of campus data for every screen.
 *
 * Sources, in order of preference:
 *   1. A campus pack imported on this phone (stored in IndexedDB, validated).
 *   2. The bundled demo pack that ships inside the APK.
 *
 * For the DEMO pack only, the origin can be moved to the user's current GPS
 * position so the invented routes can be walked outdoors for testing. That
 * is never allowed for a real (non-demo) pack.
 *
 * Screens use useCampusPack() so they re-render when data changes.
 * Code outside React uses getCampusPack().
 */

import { useSyncExternalStore } from "react";
import { DEMO_CAMPUS_PACK } from "./demo-pack.ts";
import { parseCampusPack, validateCampusPack } from "./validate.ts";
import type { CampusPack, Poi } from "./types.ts";
import { idbAvailable, idbDelete, idbGet, idbPut, KV } from "../offline/idb.ts";

export type PackSource = "bundled" | "imported";

export interface CampusState {
  pack: CampusPack;
  source: PackSource;
  importedAt?: string;
  /** Set when the demo campus has been moved to the user's location. */
  demoOrigin?: { lat: number; lng: number };
}

const PACK_KEY = "activePack";
const DEMO_ORIGIN_KEY = "vitiar.demoOrigin.v1";

const bundled = parseCampusPack(DEMO_CAMPUS_PACK);
let base: { pack: CampusPack; source: PackSource; importedAt?: string } = { pack: bundled, source: "bundled" };
let state: CampusState = derive();
const listeners = new Set<() => void>();
let loadStarted = false;

function readDemoOrigin(): { lat: number; lng: number } | undefined {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(DEMO_ORIGIN_KEY) : null;
    if (!raw) return undefined;
    const o = JSON.parse(raw) as { lat?: unknown; lng?: unknown };
    if (typeof o.lat === "number" && typeof o.lng === "number" && Math.abs(o.lat) <= 90 && Math.abs(o.lng) <= 180) {
      return { lat: o.lat, lng: o.lng };
    }
  } catch {
    // ignore unreadable value
  }
  return undefined;
}

function derive(): CampusState {
  const demoOrigin = base.pack.isDemo ? readDemoOrigin() : undefined;
  const pack = demoOrigin
    ? { ...base.pack, origin: demoOrigin, name: `${base.pack.name}, placed at your location` }
    : base.pack;
  return { ...base, pack, demoOrigin };
}

function emit() {
  state = derive();
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!loadStarted) void loadStoredPack();
  return () => {
    listeners.delete(cb);
  };
}

const serverState: CampusState = { pack: bundled, source: "bundled" };

export function useCampusState(): CampusState {
  return useSyncExternalStore(subscribe, () => state, () => serverState);
}

export function useCampusPack(): CampusPack {
  return useCampusState().pack;
}

export function getCampusPack(): CampusPack {
  return state.pack;
}

export function getPoi(id: string | null | undefined): Poi | undefined {
  if (!id) return undefined;
  return state.pack.pois.find((p) => p.id === id);
}

/** Default starting point when live location is off or unusable. */
export const DEFAULT_START_POI_ID = "poi-gate";

/** Load an imported pack from IndexedDB, if one exists and is still valid. */
export async function loadStoredPack(): Promise<void> {
  loadStarted = true;
  if (!idbAvailable()) return;
  try {
    const stored = await idbGet<{ pack: unknown; importedAt: string }>(KV, PACK_KEY);
    if (!stored) return;
    const check = validateCampusPack(stored.pack);
    if (!check.ok) return; // never route on invalid data; keep the bundled pack
    base = { pack: stored.pack as CampusPack, source: "imported", importedAt: stored.importedAt };
    emit();
  } catch {
    // Storage unavailable: keep the bundled pack.
  }
}

/** Validate and install a campus pack from JSON text. Returns the problems found, if any. */
export async function importPack(jsonText: string): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch {
    return { ok: false, errors: ["The file is not valid JSON."] };
  }
  const check = validateCampusPack(data);
  if (!check.ok) return { ok: false, errors: check.errors };
  const importedAt = new Date().toISOString();
  try {
    await idbPut(KV, { pack: data, importedAt }, PACK_KEY);
  } catch (e) {
    return { ok: false, errors: [`Could not save on this phone: ${(e as Error).message}`] };
  }
  base = { pack: data as CampusPack, source: "imported", importedAt };
  emit();
  return { ok: true };
}

/** Remove the imported pack and go back to the bundled demo. */
export async function resetToBundled(): Promise<void> {
  try {
    await idbDelete(KV, PACK_KEY);
  } catch {
    // nothing stored
  }
  base = { pack: bundled, source: "bundled" };
  emit();
}

/** Demo only: put the demo campus origin (the main gate) at this position. */
export function setDemoOrigin(origin: { lat: number; lng: number } | null): void {
  if (!base.pack.isDemo) throw new Error("Only the demo map can be moved");
  try {
    if (origin) window.localStorage.setItem(DEMO_ORIGIN_KEY, JSON.stringify(origin));
    else window.localStorage.removeItem(DEMO_ORIGIN_KEY);
  } catch {
    // storage unavailable: change applies until the app closes
  }
  emit();
}
