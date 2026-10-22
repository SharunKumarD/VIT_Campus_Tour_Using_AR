import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_CAMPUS_PACK as PACK } from "../src/lib/campus/demo-pack.ts";
import { campusToLatLng } from "../src/lib/routing/geo.ts";
import { classifyAccuracy, isStale, locate } from "../src/lib/location/position.ts";

const fixAt = (x: number, y: number, accuracyM = 5) => ({ ...campusToLatLng(PACK.origin, { x, y }), accuracyM, timestamp: 0 });

test("accuracy classes", () => {
  assert.equal(classifyAccuracy(4), "good");
  assert.equal(classifyAccuracy(18), "fair");
  assert.equal(classifyAccuracy(60), "poor");
  assert.equal(classifyAccuracy(Number.NaN), "poor");
  assert.equal(classifyAccuracy(-1), "poor");
});

test("a good fix near the gate snaps to the gate and can start routing", () => {
  const l = locate(PACK, fixAt(3, 6));
  assert.equal(l.onCampus, true);
  assert.equal(l.nearest?.node.id, "gate");
  assert.equal(l.canStartHere, true);
  assert.ok(Math.abs(l.campus.x - 3) < 0.01 && Math.abs(l.campus.y - 6) < 0.01);
});

test("GPS never snaps to an indoor node", () => {
  const l = locate(PACK, fixAt(165, 325)); // on top of the library hall
  assert.notEqual(l.nearest?.node.indoor, true);
});

test("a poor fix is located but may not start a route", () => {
  const l = locate(PACK, fixAt(3, 6, 60));
  assert.equal(l.quality, "poor");
  assert.equal(l.canStartHere, false);
});

test("far from campus: no snapping, distance reported", () => {
  const l = locate(PACK, fixAt(5000, 0));
  assert.equal(l.onCampus, false);
  assert.equal(l.nearest, null);
  assert.equal(l.canStartHere, false);
  assert.ok(l.distanceFromMapM > 4700 && l.distanceFromMapM < 4900);
});

test("stale fixes are detected", () => {
  assert.equal(isStale({ lat: 0, lng: 0, accuracyM: 5, timestamp: 0 }, 31_000), true);
  assert.equal(isStale({ lat: 0, lng: 0, accuracyM: 5, timestamp: 0 }, 10_000), false);
});
