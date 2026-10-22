import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_CAMPUS_PACK as PACK } from "../src/lib/campus/demo-pack.ts";
import { buildNavPayload, checkpointName } from "../src/lib/native/nav-payload.ts";
import { findRoute, STEP_FREE_PROFILE, type RouteSuccess } from "../src/lib/routing/index.ts";

const cp = (id: string) => PACK.checkpoints.find((c) => c.id === id)!;

function route(from: string, to: string, profile = STEP_FREE_PROFILE): RouteSuccess {
  const r = findRoute(PACK, from, to, profile);
  assert.equal(r.ok, true);
  return r as RouteSuccess;
}

test("payload carries the route, instructions and on-route checkpoints", () => {
  const r = route("a-lobby", "a-lab-101");
  const p = buildNavPayload(PACK, r, cp("cp-a-lobby"), "Demo Lab 101");
  assert.equal(p.version, 1);
  assert.equal(p.destinationName, "Lab 101");
  assert.equal(p.startCheckpointId, "cp-a-lobby");
  assert.deepEqual(p.nodes.map((n) => n.id), r.nodeIds);
  assert.equal(p.instructions.length, r.instructions.length);
  // Both Block A markers are on this route (ground-floor lobby and first-floor corridor).
  assert.deepEqual(p.checkpoints.map((c) => c.id).sort(), ["cp-a-corr-1", "cp-a-lobby"]);
  const corr = p.checkpoints.find((c) => c.id === "cp-a-corr-1")!;
  assert.equal(corr.level, 1);
  assert.equal(corr.name, "first-floor corridor");
  assert.equal(corr.marker, "VITIAR-CP-0002");
});

test("checkpoints off the route are not sent", () => {
  const p = buildNavPayload(PACK, route("gate", "lib-hall"), cp("cp-gate"), "Demo Central Library");
  assert.deepEqual(p.checkpoints.map((c) => c.id), ["cp-gate"]);
});

test("instructions reference nodes that are in the payload", () => {
  const p = buildNavPayload(PACK, route("gate", "a-lab-101"), cp("cp-gate"), "Lab");
  const ids = new Set(p.nodes.map((n) => n.id));
  for (const i of p.instructions) assert.ok(ids.has(i.atNodeId), i.atNodeId);
});

test("refuses a route that does not start at the checkpoint", () => {
  assert.throws(() => buildNavPayload(PACK, route("j1", "lib-hall"), cp("cp-gate"), "x"), /must start at the chosen checkpoint/);
});

test("payload is plain JSON (survives the native bridge)", () => {
  const p = buildNavPayload(PACK, route("gate", "lib-hall"), cp("cp-gate"), "Library");
  assert.deepEqual(JSON.parse(JSON.stringify(p)), p);
});

test("guidance policy defaults to gated and can be set for the study baseline", () => {
  assert.equal(buildNavPayload(PACK, route("gate", "lib-hall"), cp("cp-gate"), "L").policy, "gated");
  assert.equal(buildNavPayload(PACK, route("gate", "lib-hall"), cp("cp-gate"), "L", "always").policy, "always");
});

test("checkpoint names come from landmarks", () => {
  assert.equal(checkpointName(PACK, cp("cp-gate")), "main gate");
});
