import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_CAMPUS_PACK as PACK } from "../src/lib/campus/demo-pack.ts";
import { categoriesIn, normalize, searchPois } from "../src/lib/campus/search.ts";
import { DEFAULT_PREFS, formatDuration, parsePrefs, profileFromPrefs } from "../src/lib/settings/prefs.ts";
import { fitViewport, niceScale } from "../src/lib/map/projection.ts";

const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

test("search normalises case, accents and punctuation", () => {
  assert.equal(normalize("  Lab-101, Café! "), "lab 101 cafe");
});

test("search finds places by name, prefix and alias", () => {
  assert.equal(searchPois(PACK, "library")[0].id, "poi-library");
  assert.equal(searchPois(PACK, "lib")[0].id, "poi-library");
  assert.equal(searchPois(PACK, "canteen")[0].id, "poi-food");
  assert.equal(searchPois(PACK, "LAB 101")[0].id, "poi-lab-101");
  assert.equal(searchPois(PACK, "clinic")[0].id, "poi-health");
});

test('the word "demo" alone matches nothing; nonsense matches nothing', () => {
  assert.deepEqual(searchPois(PACK, "demo"), []);
  assert.deepEqual(searchPois(PACK, "zzzz"), []);
});

test("empty search lists everything A to Z, and category filters apply", () => {
  const all = searchPois(PACK, "");
  assert.equal(all.length, PACK.pois.length);
  const names = all.map((p) => p.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
  assert.deepEqual(ids(searchPois(PACK, "", { category: "food" })), ["poi-food"]);
  assert.deepEqual(searchPois(PACK, "library", { category: "food" }), []);
  assert.equal(searchPois(PACK, "", { limit: 2 }).length, 2);
});

test("categoriesIn lists only categories that have places", () => {
  const cats = categoriesIn(PACK);
  assert.ok(cats.includes("library") && cats.includes("hostel"));
  assert.ok(!cats.includes("sports"));
});

test("stored preferences are validated, with safe defaults", () => {
  assert.deepEqual(parsePrefs(null), DEFAULT_PREFS);
  assert.deepEqual(parsePrefs("not json"), DEFAULT_PREFS);
  assert.deepEqual(parsePrefs('{"stepFree":"yes"}'), DEFAULT_PREFS);
  assert.equal(parsePrefs('{"stepFree":true}').stepFree, true);
});

test("preferences map to the right routing profile", () => {
  const sf = profileFromPrefs({ ...DEFAULT_PREFS, stepFree: true });
  assert.equal(sf.stepFree, true);
  assert.equal(sf.maxSlopePct, 8.33);
  const plain = profileFromPrefs(DEFAULT_PREFS);
  assert.equal(plain.stepFree, false);
  assert.equal(plain.maxSlopePct, undefined);
  assert.equal(profileFromPrefs({ ...DEFAULT_PREFS, slowerPace: true }).walkingSpeedMps, 0.8);
  assert.equal(profileFromPrefs({ ...DEFAULT_PREFS, avoidUnpaved: true }).avoidUnpaved, true);
});

test("durations read naturally", () => {
  assert.equal(formatDuration(0), "0 min");
  assert.equal(formatDuration(20), "1 min");
  assert.equal(formatDuration(340), "6 min");
  assert.equal(formatDuration(3900), "1 h 5 min");
});

test("map projection keeps north up and fits the width", () => {
  const vp = fitViewport([{ x: 0, y: 0 }, { x: 100, y: 200 }], 300, 20);
  const south = vp.project({ x: 0, y: 0 });
  const north = vp.project({ x: 100, y: 200 });
  assert.ok(north.y < south.y, "north must be higher on screen");
  assert.equal(south.x, 20);
  assert.equal(north.x, 280);
  assert.equal(vp.height, 2 * 20 + 200 * (260 / 100));
});

test("scale bar picks round numbers", () => {
  assert.equal(niceScale(43), 50);
  assert.equal(niceScale(120), 100);
  assert.equal(niceScale(260), 200);
  assert.equal(niceScale(0.7), 0.5);
});
