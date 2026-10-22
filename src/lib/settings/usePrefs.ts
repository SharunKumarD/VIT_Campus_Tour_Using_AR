"use client";

/**
 * React hook for accessibility preferences, saved on this phone only.
 * Uses useSyncExternalStore so every screen sees changes immediately.
 * localStorage can throw (private mode, blocked storage), so every access
 * is wrapped and the app falls back to defaults.
 */

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_PREFS, parsePrefs, PREFS_STORAGE_KEY, type Prefs } from "./prefs.ts";

const listeners = new Set<() => void>();
let lastRaw: string | null | undefined;
let lastPrefs: Prefs = DEFAULT_PREFS;
/** Used only if the phone refuses storage writes; lasts until the app closes. */
let memoryRaw: string | undefined;

function readRaw(): string | null {
  if (memoryRaw !== undefined) return memoryRaw;
  try {
    return window.localStorage.getItem(PREFS_STORAGE_KEY);
  } catch {
    return null;
  }
}

function getSnapshot(): Prefs {
  const raw = readRaw();
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastPrefs = parsePrefs(raw);
  }
  return lastPrefs;
}

const getServerSnapshot = () => DEFAULT_PREFS;

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function savePrefs(next: Prefs) {
  try {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: keep the change for this session only.
    memoryRaw = JSON.stringify(next);
  }
  listeners.forEach((l) => l());
}

export function usePrefs(): [Prefs, (patch: Partial<Prefs>) => void, () => void] {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const update = useCallback((patch: Partial<Prefs>) => savePrefs({ ...getSnapshot(), ...patch }), []);
  const reset = useCallback(() => savePrefs({ ...DEFAULT_PREFS }), []);
  return [prefs, update, reset];
}
