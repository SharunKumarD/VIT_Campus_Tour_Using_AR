import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_CAMPUS_PACK as PACK } from "../src/lib/campus/demo-pack.ts";
import type { CampusPack } from "../src/lib/campus/types.ts";
import {
  DEFAULT_PROFILE,
  STEP_FREE_PROFILE,
  findRoute,
  findRouteToPoi,
  nearestNode,
  type RouteResult,
  type RouteSuccess,
} from "../src/lib/routing/index.ts";

function ok(r: RouteResult): RouteSuccess {
  assert.equal(r.ok, true, r.ok ? "" : r.message);
  return r as RouteSuccess;
}

const edgeIds = (r: RouteSuccess) => r.legs.map((l) => l.edge.id);

/** Deep copy of the demo pack with some edges modified. */
function withEdges(patch: Record<string, Partial<CampusPack["edges"][number]>>): CampusPack {
  const copy: CampusPack = structuredClone(PACK);
  copy.edges = copy.edges.map((e) => (patch[e.id] ? { ...e, ...patch[e.id] } : e));
  return copy;
}

test("default profile takes the stepped shortcut and front steps to the library", () => {
  const r = ok(findRoute(PACK, "gate", "lib-hall"));
  assert.deepEqual(r.nodeIds, ["gate", "j1", "j3", "lib-steps", "lib-front", "lib-hall"]);
  assert.equal(r.hasStepsOrUnknown, true);
});

test("step-free profile uses the library ramp and never a stepped edge", () => {
  const r = ok(findRoute(PACK, "gate", "lib-hall", STEP_FREE_PROFILE));
  assert.ok(r.nodeIds.includes("ramp-foot") && r.nodeIds.includes("lib-side"));
  for (const leg of r.legs) assert.equal(leg.edge.steps, "none", `stepped edge used: ${leg.edge.id}`);
  assert.equal(r.hasStepsOrUnknown, false);
});

test("step-free route to an upper floor uses the lift; default route uses the stairs", () => {
  const sf = ok(findRoute(PACK, "gate", "a-lab-101", STEP_FREE_PROFILE));
  assert.ok(edgeIds(sf).includes("a-lift-0--a-lift-1"));
  assert.ok(sf.instructions.some((i) => i.type === "lift" && i.text === "Take the lift to floor 1"));

  const walk = ok(findRoute(PACK, "gate", "a-lab-101", DEFAULT_PROFILE));
  assert.ok(edgeIds(walk).includes("a-stair-0--a-stair-1"));
  assert.ok(walk.instructions.some((i) => i.type === "stairs"));
});

test("edges with unknown step data are excluded under step-free, used otherwise", () => {
  const walk = ok(findRoute(PACK, "gate", "food"));
  assert.ok(edgeIds(walk).includes("j1--food"), "default should use the shorter unsurveyed path");

  const sf = ok(findRoute(PACK, "gate", "food", STEP_FREE_PROFILE));
  assert.ok(!edgeIds(sf).includes("j1--food"));
  assert.ok(sf.distanceM > walk.distanceM);
});

test("avoidUnpaved is a soft preference that steers away from unpaved paths", () => {
  const r = ok(findRoute(PACK, "gate", "food", { ...DEFAULT_PROFILE, avoidUnpaved: true }));
  assert.ok(!edgeIds(r).includes("j1--food"));
});

test("restricted edges need a matching role", () => {
  const denied = findRoute(PACK, "gate", "hostel");
  assert.equal(denied.ok, false);
  if (!denied.ok) {
    assert.equal(denied.reason, "unreachable");
    assert.deepEqual(denied.blockers, [{ reason: "restricted", edgeIds: ["j5--hostel"] }]);
    assert.match(denied.message, /restricted access/);
  }
  ok(findRoute(PACK, "gate", "hostel", { ...DEFAULT_PROFILE, roles: ["hostel-resident"] }));
});

test("closed edges are never used and the route adapts", () => {
  const pack = withEdges({ "j1--j3": { closed: true } });
  const r = ok(findRoute(pack, "gate", "lib-hall"));
  assert.ok(!edgeIds(r).includes("j1--j3"));
});

test("unreachable step-free destination explains the blocking constraint", () => {
  const pack = withEdges({ "ramp-foot--lib-side": { closed: true } });
  const r = findRoute(pack, "gate", "lib-hall", STEP_FREE_PROFILE);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.reason, "unreachable");
    const reasons = r.blockers.map((b) => b.reason);
    assert.ok(reasons.includes("steps"), `blockers were ${JSON.stringify(r.blockers)}`);
  }
});

test("a destination with no mapped connection reports no blockers", () => {
  const pack: CampusPack = structuredClone(PACK);
  pack.nodes.push({ id: "island", kind: "destination", x: 900, y: 900, level: 0, indoor: false, provenance: PACK.nodes[0].provenance });
  const r = findRoute(pack, "gate", "island");
  assert.equal(r.ok, false);
  if (!r.ok) assert.deepEqual(r.blockers, []);
});

test("unknown node ids are reported, not thrown", () => {
  const r = findRoute(PACK, "gate", "does-not-exist");
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "unknown-node");
  assert.equal(findRouteToPoi(PACK, "gate", "poi-nope").ok, false);
});

test("start equals destination gives an empty, valid route", () => {
  const r = ok(findRoute(PACK, "food", "food"));
  assert.equal(r.distanceM, 0);
  assert.equal(r.legs.length, 0);
  assert.equal(r.instructions.at(-1)?.type, "arrive");
});

test("routes to a POI resolve its node, and demo data is flagged", () => {
  const r = ok(findRouteToPoi(PACK, "gate", "poi-library", STEP_FREE_PROFILE));
  assert.equal(r.nodeIds.at(-1), "lib-hall");
  assert.equal(r.dataStatus, "demo");
});

test("distance is the sum of real edge lengths and legs are connected", () => {
  for (const to of ["lib-hall", "a-lab-101", "food", "health"]) {
    for (const profile of [DEFAULT_PROFILE, STEP_FREE_PROFILE]) {
      const r = ok(findRoute(PACK, "gate", to, profile));
      assert.equal(r.distanceM, r.legs.reduce((s, l) => s + l.edge.lengthM, 0));
      r.legs.forEach((leg, i) => {
        assert.equal(leg.from.id, r.nodeIds[i]);
        assert.equal(leg.to.id, r.nodeIds[i + 1]);
      });
      assert.equal(r.instructions[0].type, "depart");
      assert.equal(r.instructions.at(-1)?.type, "arrive");
    }
  }
});

test("nearestNode snaps a GPS-style point to the closest outdoor node", () => {
  const hit = nearestNode(PACK, { x: 4, y: 7 }, { outdoorOnly: true });
  assert.equal(hit?.node.id, "gate");
  const indoorProbe = nearestNode(PACK, { x: 165, y: 324 }, { outdoorOnly: true });
  assert.notEqual(indoorProbe?.node.indoor, true);
});
