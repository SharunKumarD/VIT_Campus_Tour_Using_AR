/**
 * Research session records and their export formats. Pure functions (tested).
 *
 * A record is created after every AR guidance session. It contains no name,
 * no account, and no GPS coordinates: only route ids, timings, distances and
 * guidance events, so it can be shared for analysis with consent.
 */

import type { NavSession } from "../native/nav-session.ts";
import type { RouteProfile } from "../routing/profile.ts";

export interface SessionRecord {
  id?: number;
  app: "VIT ImmersiveAR";
  recordedAt: string;
  dataVersion: string;
  dataIsDemo: boolean;
  destination: string;
  startCheckpoint: string;
  profile: RouteProfile;
  plannedDistanceM: number;
  session: NavSession;
}

const MODES = ["ALIGNING", "GUIDING", "DEGRADED", "LOST", "NEED_REALIGN", "ARRIVED"] as const;

export const CSV_COLUMNS = [
  "recordedAt", "dataVersion", "dataIsDemo", "destination", "startCheckpoint", "stepFree", "policy",
  "outcome", "durationS", "plannedDistanceM", "walkedM", "remainingM", "realigns",
  "trackingLosses", "offRouteEvents",
  ...MODES.map((m) => `seconds_${m}`),
] as const;

function cell(v: unknown): string {
  const s = v === undefined || v === null ? "" : String(v);
  // Quote when needed; neutralise spreadsheet formula injection (=, +, -, @ at start).
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(records: readonly SessionRecord[]): string {
  const rows = records.map((r) => {
    const ev = r.session.events;
    const values: Record<(typeof CSV_COLUMNS)[number], unknown> = {
      recordedAt: r.recordedAt,
      dataVersion: r.dataVersion,
      dataIsDemo: r.dataIsDemo,
      destination: r.destination,
      startCheckpoint: r.startCheckpoint,
      stepFree: r.profile.stepFree,
      policy: r.session.policy ?? "gated",
      outcome: r.session.outcome,
      durationS: r.session.durationS,
      plannedDistanceM: r.plannedDistanceM,
      walkedM: r.session.walkedM,
      remainingM: r.session.remainingM,
      realigns: r.session.realigns,
      trackingLosses: ev.filter((e) => e.type === "TRACKING_LOST").length,
      offRouteEvents: ev.filter((e) => e.type === "OFF_ROUTE").length,
      seconds_ALIGNING: r.session.modeSeconds.ALIGNING ?? 0,
      seconds_GUIDING: r.session.modeSeconds.GUIDING ?? 0,
      seconds_DEGRADED: r.session.modeSeconds.DEGRADED ?? 0,
      seconds_LOST: r.session.modeSeconds.LOST ?? 0,
      seconds_NEED_REALIGN: r.session.modeSeconds.NEED_REALIGN ?? 0,
      seconds_ARRIVED: r.session.modeSeconds.ARRIVED ?? 0,
    };
    return CSV_COLUMNS.map((c) => cell(values[c])).join(",");
  });
  return [CSV_COLUMNS.join(","), ...rows].join("\r\n") + "\r\n";
}

/** Recovery times (seconds) from each TRACKING_LOST to the following TRACKING_RECOVERED. */
export function recoveryTimesS(session: NavSession): number[] {
  const out: number[] = [];
  let lostAt: number | null = null;
  for (const e of session.events) {
    if (e.type === "TRACKING_LOST") lostAt = e.t;
    else if (e.type === "TRACKING_RECOVERED" && lostAt !== null) {
      out.push(Math.round((e.t - lostAt) * 1000) / 1000);
      lostAt = null;
    }
  }
  return out;
}
