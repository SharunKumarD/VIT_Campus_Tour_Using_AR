import { test } from "node:test";
import assert from "node:assert/strict";
import { arrivalRadiusM, bearingDeg, compassWord, distanceM, relativeBearing, unwrapRotation, wrap180 } from "../src/lib/landmarks/geo.ts";

test("distance: 0.001° latitude is about 111 m", () => {
  const d = distanceM({ lat: 12.97, lng: 79.16 }, { lat: 12.971, lng: 79.16 });
  assert.ok(Math.abs(d - 111.2) < 0.5, String(d));
});

test("distance: 0.001° longitude near Vellore is about 108 m", () => {
  const d = distanceM({ lat: 12.97, lng: 79.16 }, { lat: 12.97, lng: 79.161 });
  assert.ok(Math.abs(d - 108.4) < 0.5, String(d));
});

test("bearing: due north, east, south, west", () => {
  const o = { lat: 12.97, lng: 79.16 };
  assert.ok(Math.abs(bearingDeg(o, { lat: 12.98, lng: 79.16 }) - 0) < 0.01);
  assert.ok(Math.abs(bearingDeg(o, { lat: 12.97, lng: 79.17 }) - 90) < 0.1);
  assert.ok(Math.abs(bearingDeg(o, { lat: 12.96, lng: 79.16 }) - 180) < 0.01);
  assert.ok(Math.abs(bearingDeg(o, { lat: 12.97, lng: 79.15 }) - 270) < 0.1);
});

test("relative bearing wraps around north", () => {
  assert.equal(relativeBearing(10, 350), 20);
  assert.equal(relativeBearing(350, 10), -20);
  assert.equal(wrap180(540), 180);
});

test("unwrap keeps the arrow turning the short way", () => {
  assert.equal(unwrapRotation(359, 1), 361);
  assert.equal(unwrapRotation(-180, 170), -190);
});

test("arrival radius is never tighter than 15 m or looser than 40 m", () => {
  assert.equal(arrivalRadiusM(4), 15);
  assert.equal(arrivalRadiusM(25), 25);
  assert.equal(arrivalRadiusM(200), 40);
  assert.equal(arrivalRadiusM(NaN), 40);
});

test("compass words", () => {
  assert.equal(compassWord(0), "north");
  assert.equal(compassWord(93), "east");
  assert.equal(compassWord(225), "south-west");
  assert.equal(compassWord(359), "north");
});

import { buildOutdoorPayload } from "../src/lib/landmarks/outdoor-ar.ts";

test("outdoor AR payload: straight line from GPS fix to the building, start faces the compass heading", () => {
  const from = { lat: 12.9700, lng: 79.1590 };
  const to = { lat: 12.9709, lng: 79.1590 }; // ~100 m north
  const p = buildOutdoorPayload(from, to, 359.6, "SJT");
  assert.equal(p.nodes[0].id, "here");
  assert.equal(p.nodes.at(-1)!.id, "dest");
  assert.equal(p.checkpoints[0].nodeId, "here");
  assert.equal(p.checkpoints[0].facingDeg, 0);
  assert.equal(p.policy, "always");
  const last = p.nodes.at(-1)!;
  assert.ok(Math.abs(last.x) < 0.5 && Math.abs(last.y - 100) < 1, JSON.stringify(last));
  for (let i = 1; i < p.nodes.length; i++) {
    const a = p.nodes[i - 1], b = p.nodes[i];
    assert.ok(Math.hypot(b.x - a.x, b.y - a.y) <= 10.01);
  }
});

test("outdoor AR payload refuses missing heading, arrival and very far targets", () => {
  const a = { lat: 12.97, lng: 79.159 };
  assert.throws(() => buildOutdoorPayload(a, { lat: 12.971, lng: 79.159 }, NaN, "X"));
  assert.throws(() => buildOutdoorPayload(a, a, 0, "X"));
  assert.throws(() => buildOutdoorPayload(a, { lat: 13.0, lng: 79.159 }, 0, "X"));
});
