"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader.tsx";
import { recoveryTimesS, toCsv, type SessionRecord } from "@/lib/research/session-log.ts";
import { deleteAllSessions, listSessions } from "@/lib/research/sessions.ts";
import { formatDistance } from "@/lib/routing/index.ts";
import { formatDuration } from "@/lib/settings/prefs.ts";
import { usePrefs } from "@/lib/settings/usePrefs.ts";

const OUTCOME: Record<string, string> = { arrived: "Arrived", ended: "Ended early", map: "Switched to map" };

export default function ResearchPage() {
  const [sessions, setSessions] = useState<SessionRecord[] | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [prefs, setPrefs] = usePrefs();

  const load = useCallback(async () => {
    try {
      setSessions(await listSessions());
    } catch (e) {
      setError((e as Error).message);
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const copy = async (kind: "csv" | "json") => {
    if (!sessions?.length) return;
    try {
      const ordered = [...sessions].reverse();
      await navigator.clipboard.writeText(kind === "csv" ? toCsv(ordered) : JSON.stringify(ordered, null, 2));
      setNote(kind === "csv" ? "Copied as CSV. Paste into a spreadsheet." : "Copied as JSON.");
    } catch {
      setNote("Could not copy on this phone.");
    }
  };

  const clearAll = async () => {
    await deleteAllSessions();
    setConfirming(false);
    setNote("All sessions deleted from this phone.");
    await load();
  };

  return (
    <>
      <PageHeader title="Research sessions" back="/settings/" />
      <div className="space-y-4 px-4 pt-4">
        <p className="text-sm leading-relaxed text-muted">
          Each AR guidance session is saved here: timings, distance walked, and when guidance degraded, paused or
          recovered. No names or GPS coordinates are recorded. Nothing leaves this phone unless you copy it.
        </p>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-card px-4 py-3">
          <span className="flex-1">
            <span className="block font-semibold">Study condition: always-on AR</span>
            <span className="mt-0.5 block text-sm leading-snug text-muted">
              For comparison sessions only. Arrows stay visible even when positioning is unreliable. Leave off for normal use.
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={prefs.alwaysOnAr}
            onChange={(e) => setPrefs({ alwaysOnAr: e.target.checked })}
            className="mt-1 h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-line transition-colors before:block before:h-5 before:w-5 before:translate-x-0.5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:bg-demo checked:before:translate-x-[1.375rem]"
          />
        </label>

        {error ? <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p> : null}

        {sessions === null ? (
          <p>Loading…</p>
        ) : sessions.length === 0 ? (
          <div className="rounded-xl border border-line bg-card px-4 py-6 text-center">
            <p className="font-semibold">No sessions yet</p>
            <p className="mt-1 text-sm text-muted">Open a place and use Guide me with AR. The session appears here when you finish.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => copy("csv")} className="min-h-12 rounded-xl bg-sign font-semibold text-white">Copy as CSV</button>
              <button type="button" onClick={() => copy("json")} className="min-h-12 rounded-xl border-2 border-sign font-semibold text-sign">Copy as JSON</button>
            </div>
            <p aria-live="polite" className="text-sm text-sign">{note}</p>

            <ul className="space-y-2">
              {sessions.map((s) => {
                const rec = recoveryTimesS(s.session);
                return (
                  <li key={s.id ?? s.recordedAt} className="rounded-xl border border-line bg-card p-4 text-sm">
                    <div className="flex justify-between gap-3">
                      <p className="font-semibold">{s.destination.replace(/^poi-/, "")} from {s.startCheckpoint.replace(/^cp-/, "")}</p>
                      <p className="text-muted">{new Date(s.recordedAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</p>
                    </div>
                    <p className="mt-1">
                      {OUTCOME[s.session.outcome] ?? s.session.outcome}. {formatDuration(s.session.durationS)}, walked {formatDistance(s.session.walkedM)} of {formatDistance(s.plannedDistanceM)} planned
                      {s.session.realigns ? `, ${s.session.realigns} re-align${s.session.realigns === 1 ? "" : "s"}` : ""}.
                    </p>
                    {rec.length ? (
                      <p className="mt-1 text-muted">Tracking recovered {rec.length} time{rec.length === 1 ? "" : "s"}, slowest {Math.max(...rec).toFixed(1)} s.</p>
                    ) : null}
                    {s.session.policy === "always" ? <p className="mt-1 text-xs text-muted">Study condition: always-on AR.</p> : null}
                    {s.dataIsDemo ? <p className="mt-1 text-xs text-demo">Demo map: not a real-campus measurement.</p> : null}
                  </li>
                );
              })}
            </ul>

            {confirming ? (
              <div role="alertdialog" aria-labelledby="del-h" className="space-y-2 rounded-xl bg-danger-soft p-4 text-danger">
                <p id="del-h" className="font-bold">Delete all {sessions.length} sessions from this phone?</p>
                <p className="text-sm">This cannot be undone. Copy them first if you need them.</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={clearAll} className="min-h-11 rounded-lg bg-danger font-semibold text-white">Delete all</button>
                  <button type="button" onClick={() => setConfirming(false)} className="min-h-11 rounded-lg border-2 border-danger font-semibold">Keep them</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="min-h-12 w-full rounded-xl border-2 border-line bg-card font-semibold">
                Delete all sessions
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
