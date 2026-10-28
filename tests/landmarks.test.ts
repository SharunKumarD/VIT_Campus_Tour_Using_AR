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
