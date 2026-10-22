import { test } from "node:test";
import assert from "node:assert/strict";
import { bearing, campusToLatLng, distance, latLngToCampus, turnAngle } from "../src/lib/routing/geo.ts";

const near = (a: number, b: number, eps: number, msg?: string) => assert.ok(Math.abs(a - b) <= eps, msg ?? `${a} !≈ ${b}`);

test("campus <-> lat/lng round trip is sub-millimetre over a 2 km campus", () => {
  // Arbitrary test origin in southern India; this is not VIT data.
  const origin = { lat: 12.9, lng: 79.1 };
  for (const p of [{ x: 0, y: 0 }, { x: 1000, y: -750 }, { x: -1200, y: 1500 }]) {
    const back = latLngToCampus(origin, campusToLatLng(origin, p));
    near(back.x, p.x, 1e-3);
    near(back.y, p.y, 1e-3);
  }
});

test("100 m north is about 0.0009 degrees of latitude", () => {
  const ll = campusToLatLng({ lat: 0, lng: 0 }, { x: 0, y: 100 });
  near(ll.lat, 100 / 111_195, 1e-6);
  near(ll.lng, 0, 1e-12);
});

test("bearing uses compass convention", () => {
  const o = { x: 0, y: 0 };
  near(bearing(o, { x: 0, y: 10 }), 0, 1e-9);
  near(bearing(o, { x: 10, y: 0 }), 90, 1e-9);
  near(bearing(o, { x: 0, y: -10 }), 180, 1e-9);
  near(bearing(o, { x: -10, y: 0 }), 270, 1e-9);
  assert.ok(Number.isNaN(bearing(o, o)), "coincident points (a lift) have no bearing");
});

test("turnAngle is signed and wraps correctly (positive = right)", () => {
  assert.equal(turnAngle(0, 90), 90);
  assert.equal(turnAngle(0, 270), -90);
  assert.equal(turnAngle(350, 10), 20);
  assert.equal(turnAngle(10, 350), -20);
  assert.equal(turnAngle(0, 180), 180);
});

test("distance is Euclidean in metres", () => {
  assert.equal(distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
});
