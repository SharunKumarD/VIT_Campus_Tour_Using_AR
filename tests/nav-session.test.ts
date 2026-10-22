import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNavSession } from "../src/lib/native/nav-session.ts";

test("parses a full native session result", () => {
  const json = JSON.stringify({
    outcome: "arrived", durationS: 312.5, walkedM: 240.2, remainingM: 0, realigns: 1,
    modeSeconds: { ALIGNING: 12, GUIDING: 250, DEGRADED: 30, LOST: 4 },
    events: [{ t: 0, type: "STARTED", detail: "" }, { t: 12, type: "ALIGNED", detail: "gate" }],
    thresholds: { degradedAfterM: 40, lostAfterM: 80 },
  });
  const s = parseNavSession("arrived", json);
  assert.equal(s.outcome, "arrived");
  assert.equal(s.walkedM, 240.2);
  assert.equal(s.modeSeconds.GUIDING, 250);
  assert.equal(s.events.length, 2);
  assert.equal(s.thresholds.lostAfterM, 80);
  assert.equal(s.policy, "gated");
  assert.equal(parseNavSession("ended", '{"policy":"always"}').policy, "always");
});

test("malformed or missing data gives safe defaults instead of crashing", () => {
  for (const bad of [null, undefined, "", "not json", "[]", '{"walkedM":"far","events":[1,{"t":"x"}],"modeSeconds":5}']) {
    const s = parseNavSession("ended", bad);
    assert.equal(s.outcome, "ended");
    assert.equal(s.walkedM, 0);
    assert.deepEqual(s.events, []);
    assert.deepEqual(s.modeSeconds, {});
  }
});

test("unknown outcomes are reported as ended", () => {
  assert.equal(parseNavSession("teleported", "{}").outcome, "ended");
  assert.equal(parseNavSession("map", "{}").outcome, "map");
});
