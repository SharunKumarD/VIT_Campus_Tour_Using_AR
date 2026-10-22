/**
 * Result of one AR guidance session, sent back by the native screen
 * (android/.../ar/ArNavActivity.java). Treated as untrusted input.
 */

export type NavOutcome = "arrived" | "ended" | "map";

/** One AR guidance session, as measured on the phone (see RouteGuide.java). */
export interface NavSession {
  outcome: NavOutcome;
  durationS: number;
  walkedM: number;
  remainingM: number;
  realigns: number;
  /** Seconds spent in each guidance mode: ALIGNING, GUIDING, DEGRADED, LOST, NEED_REALIGN, ARRIVED. */
  modeSeconds: Record<string, number>;
  events: { t: number; type: string; detail: string }[];
  thresholds: Record<string, number>;
  /** Guidance policy used: "gated" (normal) or "always" (study baseline). */
  policy: "gated" | "always";
}

/** Parse the native session result defensively; unknown or missing fields get safe defaults. */
export function parseNavSession(outcome: string, json: string | null | undefined): NavSession {
  let o: Record<string, unknown> = {};
  try {
    const v: unknown = json ? JSON.parse(json) : {};
    if (v && typeof v === "object") o = v as Record<string, unknown>;
  } catch {
    // keep defaults
  }
  const num = (k: string) => (typeof o[k] === "number" && Number.isFinite(o[k]) ? (o[k] as number) : 0);
  const rec = (k: string) => {
    const v = o[k];
    if (!v || typeof v !== "object") return {};
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, x]) => typeof x === "number")) as Record<string, number>;
  };
  const events = Array.isArray(o.events)
    ? (o.events as unknown[]).flatMap((e) => {
        if (!e || typeof e !== "object") return [];
        const r = e as Record<string, unknown>;
        return typeof r.t === "number" && typeof r.type === "string"
          ? [{ t: r.t, type: r.type, detail: typeof r.detail === "string" ? r.detail : "" }]
          : [];
      })
    : [];
  const out = outcome === "arrived" || outcome === "map" ? outcome : "ended";
  return {
    outcome: out,
    durationS: num("durationS"),
    walkedM: num("walkedM"),
    remainingM: num("remainingM"),
    realigns: num("realigns"),
    modeSeconds: rec("modeSeconds"),
    events,
    thresholds: rec("thresholds"),
    policy: o.policy === "always" ? "always" : "gated",
  };
}
