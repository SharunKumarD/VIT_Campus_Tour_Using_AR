/**
 * SYNTHETIC DEMONSTRATION CAMPUS — NOT VIT VELLORE.
 *
 * Every building, path, coordinate and accessibility attribute below is
 * invented for development and testing. Names are prefixed "Demo" on purpose
 * and no real VIT building names or coordinates are used.
 *
 * Replace this with an authorized, verified campus pack before any real use.
 *
 * The origin is deliberately (0, 0) so the demo can never be mistaken for a
 * real place on a map. Positions are in metres east (x) / north (y) of it.
 *
 * Layout sketch (north is up, not to scale):
 *
 *        HOSTEL (restricted)
 *              |
 *   BLOCK A --J5------- J2 ------ J3 --ramp-- LIBRARY
 *   (lift,      |         |      / |  \steps/
 *    stairs)    |         |   (stairs shortcut)
 *     HEALTH --- J1 ------------ J4
 *                |  \(unknown)    |
 *               GATE   \------- FOOD COURT
 */

import type { CampusPack, EdgeKind, NavEdge, NavNode, NodeKind, Provenance, StepInfo, Surface } from "./types.ts";

const DEMO: Provenance = { status: "demo", source: "synthetic demo — not real campus data" };

type NodeSpec = [id: string, kind: NodeKind, x: number, y: number, extra?: Partial<NavNode>];

const nodeSpecs: NodeSpec[] = [
  ["gate", "entrance", 0, 0, { landmark: "main gate" }],
  ["j1", "intersection", 0, 100, { landmark: "first junction" }],
  ["j2", "intersection", 0, 250, { landmark: "central circle" }],
  ["j3", "intersection", 150, 250, { landmark: "library junction" }],
  ["j4", "intersection", 150, 100, { landmark: "food court junction" }],
  ["j5", "intersection", -120, 250, { landmark: "Block A junction" }],
  ["health", "destination", -120, 100, { landmark: "health centre door" }],
  ["food", "destination", 150, 40, { landmark: "food court" }],
  ["hostel", "destination", -200, 400, { landmark: "hostel gate" }],

  // Demo Library: front door has steps; side entrance via a ramp.
  ["lib-steps", "intersection", 150, 290, { landmark: "foot of the library front steps" }],
  ["lib-front", "entrance", 150, 300, { landmark: "library front door" }],
  ["ramp-foot", "ramp", 200, 262, { landmark: "foot of the library ramp" }],
  ["lib-side", "entrance", 190, 312, { landmark: "library side entrance" }],
  ["lib-hall", "destination", 165, 325, { indoor: true, buildingId: "demo-lib", landmark: "library main hall" }],

  // Demo Academic Block A: two floors, stairs and a lift.
  ["a-ent", "entrance", -120, 280, { landmark: "Block A entrance" }],
  ["a-lobby", "checkpoint", -120, 300, { indoor: true, buildingId: "demo-block-a", landmark: "Block A lobby" }],
  ["a-stair-0", "stairs", -105, 312, { indoor: true, buildingId: "demo-block-a", landmark: "Block A staircase" }],
  ["a-stair-1", "stairs", -105, 312, { indoor: true, buildingId: "demo-block-a", level: 1, landmark: "first-floor stair landing" }],
  ["a-lift-0", "lift", -135, 312, { indoor: true, buildingId: "demo-block-a", landmark: "lift lobby" }],
  ["a-lift-1", "lift", -135, 312, { indoor: true, buildingId: "demo-block-a", level: 1, landmark: "first-floor lift lobby" }],
  ["a-corr-1", "checkpoint", -120, 330, { indoor: true, buildingId: "demo-block-a", level: 1, landmark: "first-floor corridor" }],
  ["a-lab-101", "destination", -140, 350, { indoor: true, buildingId: "demo-block-a", level: 1, landmark: "Lab 101 door" }],
];

const nodes: NavNode[] = nodeSpecs.map(([id, kind, x, y, extra]) => ({
  id, kind, x, y, level: 0, indoor: false, provenance: DEMO, ...extra,
}));

const pos = new Map(nodes.map((n) => [n.id, n]));

type EdgeSpec = [
  from: string,
  to: string,
  kind: EdgeKind,
  steps: StepInfo,
  surface: Surface,
  extra?: Partial<NavEdge> & { extraM?: number },
];

/** Demo edge lengths = straight-line distance rounded up, plus optional extra for winding paths. */
const edgeSpecs: EdgeSpec[] = [
  ["gate", "j1", "path", "none", "paved", { slopePct: 1, covered: false }],
  ["j1", "j2", "path", "none", "paved", { slopePct: 1 }],
  ["j2", "j3", "path", "none", "paved", { slopePct: 2, covered: true }],
  ["j2", "j5", "path", "none", "paved", { slopePct: 1 }],
  ["j1", "j4", "path", "none", "paved", { slopePct: 1 }],
  ["j4", "j3", "path", "none", "paved", { slopePct: 3 }],
  ["j4", "food", "path", "none", "paved", { slopePct: 0 }],
  ["j1", "health", "path", "none", "paved", { slopePct: 0 }],

  // Stepped shortcut across a slope: shortest, but not step-free.
  ["j1", "j3", "path", "some", "paved", { extraM: 5 }],
  // Old footpath whose steps nobody has surveyed: must be treated as NOT step-free.
  ["j1", "food", "path", "unknown", "unpaved", { slopePct: 2, extraM: 10 }],

  // Library: front steps vs. side ramp.
  ["j3", "lib-steps", "path", "none", "paved", { slopePct: 1 }],
  ["lib-steps", "lib-front", "stairs", "some", "paved"],
  ["lib-front", "lib-hall", "door", "none", "tiled", { slopePct: 0 }],
  ["j3", "ramp-foot", "path", "none", "paved", { slopePct: 1 }],
  ["ramp-foot", "lib-side", "ramp", "none", "paved", { slopePct: 6, covered: true }],
  ["lib-side", "lib-hall", "door", "none", "tiled", { slopePct: 0 }],

  // Block A
  ["j5", "a-ent", "path", "none", "paved", { slopePct: 1 }],
  ["a-ent", "a-lobby", "door", "none", "tiled", { slopePct: 0 }],
  ["a-lobby", "a-stair-0", "corridor", "none", "tiled", { slopePct: 0 }],
  ["a-lobby", "a-lift-0", "corridor", "none", "tiled", { slopePct: 0 }],
  ["a-stair-0", "a-stair-1", "stairs", "some", "tiled", { lengthM: 12 }],
  ["a-lift-0", "a-lift-1", "lift", "none", "tiled", { lengthM: 4, slopePct: 0 }],
  ["a-stair-1", "a-corr-1", "corridor", "none", "tiled", { slopePct: 0 }],
  ["a-lift-1", "a-corr-1", "corridor", "none", "tiled", { slopePct: 0 }],
  ["a-corr-1", "a-lab-101", "corridor", "none", "tiled", { slopePct: 0 }],

  // Hostel: residents only.
  ["j5", "hostel", "path", "none", "paved", { slopePct: 2, allowedRoles: ["hostel-resident"] }],
];

const edges: NavEdge[] = edgeSpecs.map(([from, to, kind, steps, surface, extra = {}]) => {
  const a = pos.get(from)!;
  const b = pos.get(to)!;
  const { extraM = 0, ...rest } = extra;
  const lengthM = rest.lengthM ?? Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)) + extraM;
  return {
    id: `${from}--${to}`,
    from, to, bidirectional: true, kind, steps, surface, provenance: DEMO,
    ...rest,
    lengthM,
  };
});

export const DEMO_CAMPUS_PACK: CampusPack = {
  schemaVersion: 1,
  version: "demo-2026.10.23",
  publishedAt: "2026-10-23T00:00:00.000Z",
  name: "Demo Campus (synthetic — not VIT data)",
  isDemo: true,
  origin: { lat: 0, lng: 0 },
  buildings: [
    { id: "demo-lib", name: "Demo Central Library", levels: [0], provenance: DEMO },
    { id: "demo-block-a", name: "Demo Academic Block A", levels: [0, 1], provenance: DEMO },
  ],
  nodes,
  edges,
  pois: [
    { id: "poi-gate", name: "Demo Main Gate", category: "entrance", nodeId: "gate", aliases: ["gate", "entrance"], provenance: DEMO },
    { id: "poi-library", name: "Demo Central Library", category: "library", nodeId: "lib-hall", accessibleEntranceNodeId: "lib-side", aliases: ["library", "books"], provenance: DEMO },
    { id: "poi-block-a", name: "Demo Academic Block A", category: "academic", nodeId: "a-lobby", aliases: ["block a", "academic"], provenance: DEMO },
    { id: "poi-lab-101", name: "Demo Lab 101 (Block A, 1st floor)", category: "laboratory", nodeId: "a-lab-101", aliases: ["lab", "lab 101"], provenance: DEMO },
    { id: "poi-food", name: "Demo Food Court", category: "food", nodeId: "food", aliases: ["food", "canteen", "mess"], provenance: DEMO },
    { id: "poi-health", name: "Demo Health Centre", category: "medical", nodeId: "health", aliases: ["clinic", "medical", "hospital"], provenance: DEMO },
    { id: "poi-hostel", name: "Demo Hostel (residents only)", category: "hostel", nodeId: "hostel", aliases: ["hostel"], provenance: DEMO },
  ],
  checkpoints: [
    { id: "cp-gate", markerPayload: "VITIAR-CP-0003", nodeId: "gate", level: 0, facingDeg: 0, markerVersion: 1, provenance: DEMO },
    { id: "cp-a-lobby", markerPayload: "VITIAR-CP-0001", nodeId: "a-lobby", buildingId: "demo-block-a", level: 0, facingDeg: 0, markerVersion: 1, provenance: DEMO },
    { id: "cp-a-corr-1", markerPayload: "VITIAR-CP-0002", nodeId: "a-corr-1", buildingId: "demo-block-a", level: 1, facingDeg: 0, markerVersion: 1, provenance: DEMO },
  ],
};
