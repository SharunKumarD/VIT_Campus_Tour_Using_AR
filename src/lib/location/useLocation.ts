"use client";

/**
 * Live location, only while a screen asks for it (never in the background).
 * Uses Capacitor Geolocation: the Android location service in the app, the
 * browser API on a PC. Positions stay in memory and are never stored or sent.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Geolocation } from "@capacitor/geolocation";
import type { Fix } from "./position.ts";

export type LocationStatus = "off" | "starting" | "on" | "denied" | "unavailable";

export interface LocationState {
  status: LocationStatus;
  fix: Fix | null;
  message: string;
}

const OPTIONS = { enableHighAccuracy: true, timeout: 20_000, maximumAge: 5_000, minimumUpdateInterval: 2_000 };

function toFix(p: { coords: { latitude: number; longitude: number; accuracy: number; heading?: number | null }; timestamp: number }): Fix {
  return {
    lat: p.coords.latitude,
    lng: p.coords.longitude,
    accuracyM: p.coords.accuracy,
    timestamp: p.timestamp,
    headingDeg: p.coords.heading ?? null,
  };
}

function explain(e: unknown): { status: LocationStatus; message: string } {
  const msg = String((e as { message?: string })?.message ?? e).toLowerCase();
  if (msg.includes("denied") || msg.includes("permission")) {
    return { status: "denied", message: "Location permission is off. Allow it in Android Settings > Apps > VIT ImmersiveAR > Permissions." };
  }
  if (msg.includes("disabled") || msg.includes("location services")) {
    return { status: "unavailable", message: "Location is turned off on this phone. Turn it on in quick settings." };
  }
  return { status: "unavailable", message: "Could not get a location. Try again outdoors." };
}

/** Watch the position while `active` is true. */
export function useLocation(active: boolean): LocationState & { stop: () => void } {
  const [state, setState] = useState<LocationState>({ status: "off", fix: null, message: "" });
  const watchId = useRef<string | null>(null);

  const stop = useCallback(() => {
    const id = watchId.current;
    watchId.current = null;
    if (id) void Geolocation.clearWatch({ id }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!active) {
      stop();
      setState((s) => ({ ...s, status: "off" }));
      return;
    }
    let cancelled = false;
    setState({ status: "starting", fix: null, message: "Finding your location…" });
    (async () => {
      try {
        const perm = await Geolocation.checkPermissions().catch(() => null);
        if (perm && perm.location !== "granted") {
          const req = await Geolocation.requestPermissions({ permissions: ["location"] });
          if (req.location !== "granted") throw new Error("permission denied");
        }
        const id = await Geolocation.watchPosition(OPTIONS, (pos, err) => {
          if (cancelled) return;
          if (err || !pos) {
            const x = explain(err);
            setState((s) => ({ ...s, status: s.fix ? "on" : x.status, message: x.message }));
            return;
          }
          setState({ status: "on", fix: toFix(pos), message: "" });
        });
        if (cancelled) void Geolocation.clearWatch({ id });
        else watchId.current = id;
      } catch (e) {
        if (!cancelled) setState({ status: explain(e).status, fix: null, message: explain(e).message });
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [active, stop]);

  return { ...state, stop };
}

/** One position, for actions like "move the demo map here". */
export async function getOnePosition(): Promise<Fix> {
  const perm = await Geolocation.checkPermissions().catch(() => null);
  if (perm && perm.location !== "granted") {
    const req = await Geolocation.requestPermissions({ permissions: ["location"] });
    if (req.location !== "granted") throw new Error(explain(new Error("permission denied")).message);
  }
  try {
    return toFix(await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 }));
  } catch (e) {
    throw new Error(explain(e).message);
  }
}
