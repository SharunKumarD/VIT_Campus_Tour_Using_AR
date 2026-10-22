"use client";

/**
 * "Guide me with AR" section on the directions screen.
 *
 * AR guidance starts at a checkpoint marker: standing on it and facing its
 * arrow is what lines the AR world up with the campus map. The route is
 * computed here by the routing engine and handed to the native AR screen.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CampusPack, Poi } from "@/lib/campus/types.ts";
import { findRouteToPoi, formatDistance, REASON_LABEL } from "@/lib/routing/index.ts";
import { formatDuration, profileFromPrefs, type Prefs } from "@/lib/settings/prefs.ts";
import { ArError, checkArAvailability, isAndroidApp, startArNavigation, type NavSession } from "@/lib/native/ar.ts";
import { buildNavPayload, checkpointName } from "@/lib/native/nav-payload.ts";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const LAST_SESSION_KEY = "vitiar.navsession.last";

const OUTCOME_TEXT: Record<NavSession["outcome"], string> = {
  arrived: "Arrived",
  ended: "Ended before arriving",
  map: "Switched to the map",
};

const MODE_LABEL: Record<string, string> = {
  ALIGNING: "Aligning",
  GUIDING: "Guiding",
  DEGRADED: "Low accuracy",
  LOST: "AR paused",
  NEED_REALIGN: "Changing floor",
  ARRIVED: "Arrived",
};

export function ArGuidance({ pack, poi, prefs }: { pack: CampusPack; poi: Poi; prefs: Prefs }) {
  const [arReady, setArReady] = useState<boolean | null>(null);
  const checkpoints = useMemo(
    () => [...pack.checkpoints].sort((a, b) => checkpointName(pack, a).localeCompare(checkpointName(pack, b))),
    [pack],
  );
  const [cpId, setCpId] = useState(checkpoints[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<NavSession | null>(null);
  const [error, setError] = useState<ArError | null>(null);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (!isAndroidApp()) {
      setArReady(false);
      return;
    }
    checkArAvailability()
      .then((a) => setArReady(a.installed))
      .catch(() => setArReady(false));
  }, []);

  const cp = checkpoints.find((c) => c.id === cpId);
  const route = useMemo(
    () => (cp ? findRouteToPoi(pack, cp.nodeId, poi.id, profileFromPrefs(prefs)) : null),
    [pack, cp, poi, prefs],
  );

  if (checkpoints.length === 0) return null;

  const start = async () => {
    if (!cp || !route?.ok) return;
    setBusy(true);
    setError(null);
    setCopied("");
    try {
      const payload = buildNavPayload(pack, route, cp, poi.name);
      const s = await startArNavigation(payload);
      setSession(s);
      const log = {
        app: "VIT ImmersiveAR",
        recordedAt: new Date().toISOString(),
        dataVersion: pack.version,
        dataIsDemo: pack.isDemo,
        destination: poi.id,
        startCheckpoint: cp.id,
        profile: profileFromPrefs(prefs),
        plannedDistanceM: route.distanceM,
        session: s,
      };
      try {
        window.localStorage.setItem(LAST_SESSION_KEY, JSON.stringify(log));
      } catch {
        // Storage unavailable: the result is still shown below.
      }
    } catch (e) {
      setError(e instanceof ArError ? e : new ArError("UNKNOWN", String(e)));
    } finally {
      setBusy(false);
    }
  };

  const copyLog = async () => {
    try {
      const text = window.localStorage.getItem(LAST_SESSION_KEY) ?? JSON.stringify(session);
      await navigator.clipboard.writeText(text);
      setCopied("Session log copied. Paste it into your notes or a spreadsheet.");
    } catch {
      setCopied("Could not copy on this phone.");
    }
  };

  return (
    <section aria-labelledby="ar-guide" className="space-y-3 rounded-xl border-2 border-sign bg-card p-4">
      <h2 id="ar-guide" className="text-lg font-bold">Guide me with AR</h2>

      {arReady === false ? (
        <p className="text-sm leading-relaxed text-muted">
          AR guidance needs the Android app on an ARCore phone.{" "}
          <Link href="/ar-check/" className="font-semibold text-sign underline underline-offset-4">Check this phone</Link>
        </p>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-muted">
            Start at a marker. Stand on it, face the direction it shows, and the camera view lines up with the map.
          </p>
          <div>
            <label htmlFor="ar-start" className="text-sm font-semibold text-muted">Starting marker</label>
            <select
              id="ar-start"
              value={cpId}
              onChange={(e) => { setCpId(e.target.value); setSession(null); }}
              className="mt-1 min-h-12 w-full rounded-lg border border-line bg-paper px-3 text-base"
            >
              {checkpoints.map((c) => (
                <option key={c.id} value={c.id}>
                  {capitalize(checkpointName(pack, c))}{c.level !== 0 ? ` (floor ${c.level})` : ""}
                </option>
              ))}
            </select>
          </div>

          {route && route.ok ? (
            <>
              <p className="text-sm">
                From this marker: <strong>{formatDistance(route.distanceM)}</strong>, about {formatDuration(route.durationS)}.
              </p>
              <button
                type="button"
                onClick={start}
                disabled={busy || arReady !== true}
                className="min-h-12 w-full rounded-xl bg-sign font-semibold text-white disabled:opacity-60"
              >
                {busy ? "AR guidance open…" : arReady === null ? "Checking AR…" : "Start AR guidance"}
              </button>
            </>
          ) : route ? (
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              No route from this marker with your settings
              {route.blockers.length ? ` (${route.blockers.map((b) => REASON_LABEL[b.reason]).join(", ")})` : ""}. Choose another marker.
            </p>
          ) : null}
        </>
      )}

      {error ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error.message} <span className="text-xs">({error.code})</span>
        </p>
      ) : null}

      {session ? (
        <div className="rounded-lg bg-paper p-3 text-sm" aria-live="polite">
          <p className="font-bold">{OUTCOME_TEXT[session.outcome]}</p>
          <p className="mt-1">
            {formatDuration(session.durationS)}, walked {formatDistance(session.walkedM)}
            {session.realigns ? `, re-aligned ${session.realigns === 1 ? "once" : `${session.realigns} times`}` : ""}.
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted">
            {Object.entries(session.modeSeconds)
              .filter(([, s]) => s > 0)
              .map(([m, s]) => (
                <li key={m}>{MODE_LABEL[m] ?? m}: {Math.round(s)} s</li>
              ))}
          </ul>
          <button type="button" onClick={copyLog} className="mt-3 min-h-11 font-semibold text-sign underline underline-offset-4">
            Copy session log
          </button>
          {copied ? <p className="mt-1 text-xs text-muted">{copied}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
