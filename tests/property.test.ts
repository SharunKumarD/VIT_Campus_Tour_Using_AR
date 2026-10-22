/**
 * Randomised ("property") tests: on 1,500 random graphs and profiles, check that
 *   1. a returned route NEVER uses an edge the profile forbids, and
 *   2. A* finds exactly the optimal cost, compared with an independent
 *      brute-force Dijkstra written here from the specification, and
 *   3. A* reports "unreachable" exactly when the reference does.
 * A fixed seed makes every run reproducible.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { CampusPack, EdgeKind, NavEdge, NavNode, StepInfo, Surface } from "../src/lib/campus/types.ts";
import { validateCampusPack } from "../src/lib/campus/validate.ts";
import { findRoute, type RouteProfile } from "../src/lib/routing/index.ts";

/** mulberry32: small, deterministic PRNG. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PROV = { status: "demo" as const, source: "property test" };

function randomPack(r: () => number): CampusPack {
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const n = 4 + Math.floor(r() * 20);
  const nodes: NavNode[] = Array.from({ length: n }, (_, i) => ({
    id: `n${i}`, kind: "intersection", x: Math.round(r() * 500), y: Math.round(r() * 500), level: 0, indoor: false, provenance: PROV,
  }));
  const edges: NavEdge[] = [];
  const m = Math.floor(n * (1 + r() * 2.5));
  for (let k = 0; k < m; k++) {
    const a = nodes[Math.floor(r() * n)];
    let b = nodes[Math.floor(r() * n)];
    if (a === b) b = nodes[(nodes.indexOf(a) + 1) % n];
    const straight = Math.hypot(a.x - b.x, a.y - b.y);
    const kind: EdgeKind = pick(["path", "path", "path", "corridor", "stairs", "ramp", "lift", "door"] as const);
    const steps: StepInfo = kind === "lift" ? "none" : kind === "stairs" ? pick(["some", "unknown"] as const) : pick(["none", "none", "some", "unknown"] as const);
    edges.push({
      id: `e${k}`, from: a.id, to: b.id, bidirectional: r() < 0.8, kind, steps,
      lengthM: Math.max(1, straight * (1 + r() * 0.6)),
      slopePct: r() < 0.2 ? undefined : Math.round(r() * 12),
      surface: pick(["paved", "unpaved", "tiled", "unknown"] as const satisfies readonly Surface[]),
      covered: r() < 0.3,
      allowedRoles: r() < 0.1 ? ["staff"] : undefined,
      closed: r() < 0.08 ? true : undefined,
      provenance: PROV,
    });
  }
  return {
    schemaVersion: 1, version: "prop", publishedAt: "2026-10-23T00:00:00Z", name: "random", isDemo: true,
    origin: { lat: 0, lng: 0 }, buildings: [], nodes, edges, pois: [], checkpoints: [],
  };
}

function randomProfile(r: () => number): RouteProfile {
  return {
    stepFree: r() < 0.5,
    maxSlopePct: r() < 0.4 ? 8.33 : undefined,
    roles: r() < 0.3 ? ["staff"] : [],
    avoidUnpaved: r() < 0.3,
    preferCovered: r() < 0.3,
    walkingSpeedMps: r() < 0.5 ? 1.2 : 0.9,
  };
}

// ---- Independent reference, written from the specification (not from route.ts) ----

function allowed(e: NavEdge, p: RouteProfile): boolean {
  if (e.closed) return false;
  if (p.stepFree && e.steps !== "none") return false;
  if (p.maxSlopePct !== undefined && (e.slopePct === undefined || e.slopePct > p.maxSlopePct)) return false;
  if (e.allowedRoles && !e.allowedRoles.some((x) => (p.roles ?? []).includes(x))) return false;
  return true;
}

function refCost(e: NavEdge, straight: number, p: RouteProfile): number {
  let c = Math.max(e.lengthM, straight);
  if (e.kind === "stairs") c *= 2; // stairs at half speed
  if (e.kind === "lift") c += 45 * (p.walkingSpeedMps ?? 1.2); // 45 s wait, in metres
  if (p.avoidUnpaved && (e.surface === "unpaved" || e.surface === "unknown")) c *= 1.5;
  if (p.preferCovered && !e.covered && !["corridor", "lift", "door"].includes(e.kind)) c *= 1.2;
  return c;
}

function dijkstra(pack: CampusPack, p: RouteProfile, s: string, t: string): number {
  const pos = new Map(pack.nodes.map((n) => [n.id, n]));
  const dist = new Map(pack.nodes.map((n) => [n.id, Infinity]));
  dist.set(s, 0);
  const done = new Set<string>();
  for (;;) {
    let u: string | null = null;
    for (const [id, d] of dist) if (!done.has(id) && d < Infinity && (u === null || d < dist.get(u)!)) u = id;
    if (u === null) return Infinity;
    if (u === t) return dist.get(u)!;
    done.add(u);
    for (const e of pack.edges) {
      if (!allowed(e, p)) continue;
      const a = pos.get(e.from)!, b = pos.get(e.to)!;
      const c = refCost(e, Math.hypot(a.x - b.x, a.y - b.y), p);
      const relax = (from: string, to: string) => {
        if (from === u && dist.get(u)! + c < dist.get(to)!) dist.set(to, dist.get(u)! + c);
      };
      relax(e.from, e.to);
      if (e.bidirectional) relax(e.to, e.from);
    }
  }
}

test("A* is optimal, complete, and never uses forbidden edges (1,500 random cases)", () => {
  const r = rng(20261023);
  let routed = 0;
  let unreachable = 0;
  for (let i = 0; i < 300; i++) {
    const pack = randomPack(r);
    assert.equal(validateCampusPack(pack).ok, true, "generator must produce valid packs");
    const pos = new Map(pack.nodes.map((n) => [n.id, n]));
    for (let j = 0; j < 5; j++) {
      const profile = randomProfile(r);
      const s = pack.nodes[Math.floor(r() * pack.nodes.length)].id;
      const t = pack.nodes[Math.floor(r() * pack.nodes.length)].id;
      const expected = dijkstra(pack, profile, s, t);
      const res = findRoute(pack, s, t, profile);
      const ctx = `case ${i}.${j} ${s}->${t} ${JSON.stringify(profile)}`;

      if (expected === Infinity) {
        assert.equal(res.ok, false, `A* found a route the reference says is impossible: ${ctx}`);
        unreachable++;
        continue;
      }
      assert.equal(res.ok, true, `A* missed a route: ${ctx}`);
      if (!res.ok) continue;
      routed++;

      let cost = 0;
      res.legs.forEach((leg, k) => {
        assert.ok(allowed(leg.edge, profile), `forbidden edge ${leg.edge.id} used: ${ctx}`);
        const forward = leg.edge.from === res.nodeIds[k] && leg.edge.to === res.nodeIds[k + 1];
        const backward = leg.edge.to === res.nodeIds[k] && leg.edge.from === res.nodeIds[k + 1];
        assert.ok(forward || (backward && leg.edge.bidirectional), `one-way edge walked backwards: ${ctx}`);
        const a = pos.get(leg.edge.from)!, b = pos.get(leg.edge.to)!;
        cost += refCost(leg.edge, Math.hypot(a.x - b.x, a.y - b.y), profile);
      });
      assert.ok(Math.abs(cost - expected) < 1e-6, `suboptimal: got ${cost}, optimal ${expected}: ${ctx}`);
    }
  }
  // Sanity: the generator must exercise both outcomes meaningfully.
  assert.ok(routed > 300, `only ${routed} routable cases`);
  assert.ok(unreachable > 100, `only ${unreachable} unreachable cases`);
});
