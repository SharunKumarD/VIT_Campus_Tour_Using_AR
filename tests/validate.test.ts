import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_CAMPUS_PACK } from "../src/lib/campus/demo-pack.ts";
import { CampusPackError, parseCampusPack, validateCampusPack } from "../src/lib/campus/validate.ts";

/** JSON round-trip copy: also proves the pack survives storage as plain JSON. */
const copy = () => JSON.parse(JSON.stringify(DEMO_CAMPUS_PACK));

function expectError(mutate: (p: any) => void, pattern: RegExp) {
  const p = copy();
  mutate(p);
  const r = validateCampusPack(p);
  assert.equal(r.ok, false, "expected validation to fail");
  assert.ok(r.errors.some((e) => pattern.test(e)), `no error matched ${pattern}; got:\n${r.errors.join("\n")}`);
}

test("the demo pack is valid and survives a JSON round trip", () => {
  const r = validateCampusPack(copy());
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok, true);
});

test("the demo pack is labelled as demo everywhere", () => {
  const p = DEMO_CAMPUS_PACK;
  assert.equal(p.isDemo, true);
  for (const rec of [...p.buildings, ...p.nodes, ...p.edges, ...p.pois, ...p.checkpoints]) {
    assert.equal(rec.provenance.status, "demo");
  }
  for (const poi of p.pois) assert.match(poi.name, /^Demo /);
});

test("rejects non-objects and missing arrays", () => {
  assert.equal(validateCampusPack(null).ok, false);
  assert.equal(validateCampusPack("pack").ok, false);
  expectError((p) => delete p.edges, /edges must be an array/);
});

test("rejects a wrong schema version", () => expectError((p) => (p.schemaVersion = 2), /schemaVersion/));
test("rejects an invalid origin", () => expectError((p) => (p.origin = { lat: 123, lng: 0 }), /origin/));
test("rejects duplicate node ids", () => expectError((p) => p.nodes.push({ ...p.nodes[0] }), /duplicate id "gate"/));
test("rejects edges to unknown nodes", () => expectError((p) => (p.edges[0].to = "nowhere"), /unknown to node "nowhere"/));

test("rejects an edge shorter than the straight-line distance (keeps A* correct)", () => {
  expectError((p) => (p.edges.find((e: any) => e.id === "gate--j1").lengthM = 50), /shorter than straight-line/);
});

test("rejects a level change on a non-vertical edge", () => {
  expectError((p) => (p.edges.find((e: any) => e.id === "a-lift-0--a-lift-1").kind = "corridor"), /changes level/);
});

test("rejects a lift edge that claims steps", () => {
  expectError((p) => (p.edges.find((e: any) => e.kind === "lift").steps = "some"), /lift edge must have steps "none"/);
});

test("rejects invalid step values", () => expectError((p) => (p.edges[0].steps = "maybe"), /steps must be/));

test("rejects verified data without a verifier", () => {
  expectError((p) => (p.nodes[0].provenance = { status: "verified", source: "survey" }), /must name verifiedBy/);
});

test("rejects demo records inside a pack that claims to be real", () => {
  expectError((p) => (p.isDemo = false), /demo record in a pack with isDemo=false/);
});

test("rejects marker payloads that look like URLs", () => {
  expectError((p) => (p.checkpoints[0].markerPayload = "https://example.com/x"), /not a URL/);
});

test("rejects a checkpoint whose level does not match its node", () => {
  expectError((p) => (p.checkpoints[0].level = 1), /do not match its node/);
});

test("outdoor checkpoints have no building; indoor ones must match their node", () => {
  const ok = copy();
  assert.equal(validateCampusPack(ok).ok, true, "the outdoor gate checkpoint is valid without a buildingId");
  expectError((p) => (p.checkpoints.find((c: any) => c.id === "cp-gate").buildingId = "demo-lib"), /do not match its node/);
  expectError((p) => delete p.checkpoints.find((c: any) => c.id === "cp-a-lobby").buildingId, /do not match its node/);
});

test("rejects indoor nodes without a building", () => {
  expectError((p) => delete p.nodes.find((n: any) => n.id === "lib-hall").buildingId, /indoor nodes must have a buildingId/);
});

test("rejects POIs pointing at missing nodes", () => expectError((p) => (p.pois[0].nodeId = "ghost"), /unknown nodeId "ghost"/));

test("parseCampusPack returns a typed pack or throws CampusPackError", () => {
  assert.equal(parseCampusPack(copy()).version, DEMO_CAMPUS_PACK.version);
  const bad = copy();
  bad.edges[0].to = "nowhere";
  assert.throws(() => parseCampusPack(bad), (e: unknown) => e instanceof CampusPackError && e.errors.length > 0);
});
