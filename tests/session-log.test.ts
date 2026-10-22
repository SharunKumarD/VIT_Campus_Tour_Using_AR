import { test } from "node:test";
import assert from "node:assert/strict";
import { CSV_COLUMNS, recoveryTimesS, toCsv, type SessionRecord } from "../src/lib/research/session-log.ts";
import { STEP_FREE_PROFILE } from "../src/lib/routing/profile.ts";

const record = (over: Partial<SessionRecord> = {}): SessionRecord => ({
  app: "VIT ImmersiveAR",
  recordedAt: "2026-10-23T09:00:00.000Z",
  dataVersion: "demo-2026.10.23",
  dataIsDemo: true,
  destination: "poi-library",
  startCheckpoint: "cp-gate",
  profile: STEP_FREE_PROFILE,
  plannedDistanceM: 532,
  session: {
    outcome: "arrived", durationS: 400, walkedM: 540.5, remainingM: 0, realigns: 1,
    modeSeconds: { ALIGNING: 10, GUIDING: 300, DEGRADED: 60, LOST: 20, ARRIVED: 10 },
    events: [
      { t: 0, type: "STARTED", detail: "" },
      { t: 50, type: "TRACKING_LOST", detail: "" },
      { t: 52.5, type: "TRACKING_RECOVERED", detail: "2500" },
      { t: 90, type: "OFF_ROUTE", detail: "6.2" },
      { t: 200, type: "TRACKING_LOST", detail: "" },
      { t: 201, type: "TRACKING_RECOVERED", detail: "1000" },
    ],
    thresholds: {},
    policy: "gated",
  },
  ...over,
});

test("CSV has a header and one row per session, with derived counts", () => {
  const csv = toCsv([record(), record({ destination: "poi-food" })]);
  const lines = csv.trimEnd().split("\r\n");
  assert.equal(lines.length, 3);
  assert.equal(lines[0], CSV_COLUMNS.join(","));
  const row = Object.fromEntries(lines[0].split(",").map((k, i) => [k, lines[1].split(",")[i]]));
  assert.equal(row.outcome, "arrived");
  assert.equal(row.stepFree, "true");
  assert.equal(row.policy, "gated");
  assert.equal(row.trackingLosses, "2");
  assert.equal(row.offRouteEvents, "1");
  assert.equal(row.seconds_GUIDING, "300");
  assert.equal(row.seconds_NEED_REALIGN, "0");
});

test("CSV quotes commas and neutralises formula injection", () => {
  const csv = toCsv([record({ destination: 'Lab, "A"', startCheckpoint: "=HYPERLINK(1)" })]);
  assert.ok(csv.includes('"Lab, ""A"""'));
  assert.ok(csv.includes("'=HYPERLINK(1)"));
  assert.ok(!csv.includes(",=HYPERLINK"));
});

test("negative numbers are not mistaken for formulas", () => {
  const csv = toCsv([record({ plannedDistanceM: -1 })]);
  assert.ok(csv.includes(",-1,"));
});

test("recovery times pair each loss with its recovery", () => {
  assert.deepEqual(recoveryTimesS(record().session), [2.5, 1]);
});

test("records contain no coordinates", () => {
  const json = JSON.stringify(record());
  assert.ok(!/"lat"|"lng"|latitude|longitude/.test(json));
});
