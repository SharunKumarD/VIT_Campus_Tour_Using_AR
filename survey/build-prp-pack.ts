// Builds survey/prp-e2-ground.campus.json from the 2026-10-28 field step counts.
// Run: node --experimental-strip-types survey/build-prp-pack.ts
import { writeFileSync } from "node:fs";
import { validateCampusPack } from "../src/lib/campus/validate.ts";
import { findRoute } from "../src/lib/routing/index.ts";
import type { CampusPack, NavEdge, NavNode, Provenance } from "../src/lib/campus/types.ts";

const STEP = 0.7; // m, from height 170 cm
const SRC: Provenance = { status: "unverified", source: "Step-count field survey by project student, 2026-10-28 (not officially verified)" };
const B = "prp";
// Facing into E2 is ASSUMED north (0°) until the compass reading arrives. Indoor AR is
// consistent with this either way; only the map/GPS overlay would be rotated.
const jy = 15 * STEP;
const N = (id: string, kind: NavNode["kind"], x: number, y: number, landmark: string, indoor = true): NavNode =>
  ({ id, kind, x: +x.toFixed(2), y: +y.toFixed(2), level: 0, indoor, buildingId: indoor ? B : undefined, landmark, provenance: SRC });
const nodes: NavNode[] = [
  N("e2-out", "entrance", 0, -3, "foot of the E2 entrance steps", false),
  N("e2", "checkpoint", 0, 0, "inside the E2 entrance"),
  N("j1", "intersection", 0, jy, "main corridor junction"),
  N("g33", "destination", -10 * STEP, jy, "classroom G33"),
  N("g34", "destination", -27 * STEP, jy, "classroom G34"),
  N("g32", "destination", 26 * STEP, jy, "classroom G32"),
  N("g31", "destination", 48 * STEP, jy, "classroom G31"),
];
const pos = new Map(nodes.map((n) => [n.id, n]));
const E = (from: string, to: string, kind: NavEdge["kind"], steps: NavEdge["steps"], surface: NavEdge["surface"]): NavEdge => {
  const a = pos.get(from)!, b = pos.get(to)!;
  return { id: `${from}--${to}`, from, to, bidirectional: true, kind, steps, surface,
    lengthM: Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 10) / 10 + 0.1, covered: true, provenance: SRC };
};
const edges: NavEdge[] = [
  E("e2-out", "e2", "stairs", "some", "paved"), // ~3 steps visible in photos; no ramp seen
  { ...E("e2", "j1", "corridor", "none", "tiled"), slopePct: 0 },
  { ...E("j1", "g33", "corridor", "none", "tiled"), slopePct: 0 },
  { ...E("g33", "g34", "corridor", "none", "tiled"), slopePct: 0 },
  { ...E("j1", "g32", "corridor", "none", "tiled"), slopePct: 0 },
  { ...E("g32", "g31", "corridor", "none", "tiled"), slopePct: 0 },
];
const poi = (id: string, name: string, nodeId: string, aliases: string[], category: "academic" | "entrance" = "academic") =>
  ({ id, name, category, nodeId, aliases, provenance: SRC });
const pack: CampusPack = {
  schemaVersion: 1, version: "prp-e2-g-2026.10.28b", publishedAt: new Date().toISOString(),
  name: "PRP E2 ground floor (field survey, unverified)", isDemo: false,
  origin: { lat: 12.971579, lng: 79.165686 },
  buildings: [{ id: B, name: "PRP Block", levels: [0], provenance: SRC }],
  nodes, edges,
  pois: [
    poi("poi-e2", "PRP E2 entrance", "e2", ["e2", "prp", "entrance"], "entrance"),
    poi("poi-g31", "G31 (PRP ground floor)", "g31", ["g31"]),
    poi("poi-g32", "G32 (PRP ground floor)", "g32", ["g32"]),
    poi("poi-g33", "G33 (PRP ground floor)", "g33", ["g33"]),
    poi("poi-g34", "G34 (PRP ground floor)", "g34", ["g34"]),
  ],
  checkpoints: [{ id: "cp-prp-e2", markerPayload: "VITIAR-PRP-E2-G", nodeId: "e2", buildingId: B, level: 0, facingDeg: 0, markerVersion: 1, provenance: SRC }],
};
const v = validateCampusPack(pack);
if (!v.ok) { console.error(v.errors); process.exit(1); }
for (const t of ["g31", "g32", "g33", "g34"]) {
  const r: any = findRoute(pack, "e2", t, {} as any);
  console.log(t, r?.ok ?? r?.found ?? Object.keys(r ?? {}), r?.lengthM ?? r?.route?.lengthM ?? "");
}
writeFileSync("survey/prp-e2-ground.campus.json", JSON.stringify(pack, null, 2));
console.log("valid, written");
