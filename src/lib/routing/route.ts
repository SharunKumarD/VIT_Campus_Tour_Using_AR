/**
 * Campus route calculation: profile filtering + A* + result packaging.
 *
 * Runs entirely on-device with no network access, so it works offline.
 * It knows nothing about cameras or AR: the AR renderer only ever receives
 * a finished route from here (Phase 0–1 plan, sections 4 and 8).
 */

import type { CampusPack, NavEdge, NavNode, ProvenanceStatus } from "../campus/types.ts";
import { aStar, type Arc } from "./astar.ts";
import { distance, type XY } from "./geo.ts";
import { buildInstructions, type Instruction } from "./instructions.ts";
import { costFactor, DEFAULT_PROFILE, exclusionReasons, type ExclusionReason, type RouteProfile } from "./profile.ts";

/** Seconds added per lift ride for waiting. */
export const LIFT_WAIT_S = 45;
/** Stairs are walked at this fraction of level walking speed. */
export const STAIRS_SPEED_FACTOR = 0.5;

export interface RouteLeg {
  edge: NavEdge;
  from: NavNode;
  to: NavNode;
}

export interface RouteSuccess {
  ok: true;
  nodeIds: string[];
  legs: RouteLeg[];
  /** Real walking distance in metres (not the penalised cost). */
  distanceM: number;
  durationS: number;
  instructions: Instruction[];
  /** Weakest provenance on the route: "demo" or "unverified" must be shown to the user. */
  dataStatus: ProvenanceStatus;
  /** True if any leg uses a step-info value other than verified "none". */
  hasStepsOrUnknown: boolean;
}

export interface Blocker {
  reason: ExclusionReason;
  edgeIds: string[];
}

export interface RouteFailure {
  ok: false;
  reason: "unknown-node" | "unreachable";
  message: string;
  /**
   * For "unreachable": the constraints that block the shortest route which
   * WOULD exist if only closures were respected. Empty if no route exists at all.
   */
  blockers: Blocker[];
}

export type RouteResult = RouteSuccess | RouteFailure;

const nodeIndexCache = new WeakMap<CampusPack, Map<string, NavNode>>();

function nodeIndex(pack: CampusPack): Map<string, NavNode> {
  let idx = nodeIndexCache.get(pack);
  if (!idx) {
    idx = new Map(pack.nodes.map((n) => [n.id, n]));
    nodeIndexCache.set(pack, idx);
  }
  return idx;
}

/** Build the directed adjacency list for one profile. Excluded edges are simply absent. */
export function buildAdjacency(pack: CampusPack, profile: RouteProfile): Map<string, Arc<NavEdge>[]> {
  const nodes = nodeIndex(pack);
  const adj = new Map<string, Arc<NavEdge>[]>();
  const add = (from: string, to: string, edge: NavEdge, cost: number) => {
    const list = adj.get(from);
    if (list) list.push({ to, edge, cost });
    else adj.set(from, [{ to, edge, cost }]);
  };
  for (const edge of pack.edges) {
    if (exclusionReasons(edge, profile).length > 0) continue;
    const a = nodes.get(edge.from);
    const b = nodes.get(edge.to);
    if (!a || !b) continue; // validation rejects this; be defensive anyway
    // Cost is "equivalent metres at walking speed" so it reflects time, not just distance.
    // max() keeps the straight-line heuristic consistent even within validation tolerance;
    // the stairs and lift adjustments only ever ADD cost, so A* stays admissible.
    let base = Math.max(edge.lengthM, distance(a, b));
    if (edge.kind === "stairs") base /= STAIRS_SPEED_FACTOR;
    if (edge.kind === "lift") base += LIFT_WAIT_S * speedOf(profile);
    const cost = base * costFactor(edge, profile);
    add(edge.from, edge.to, edge, cost);
    if (edge.bidirectional) add(edge.to, edge.from, edge, cost);
  }
  return adj;
}

const STATUS_RANK: Record<ProvenanceStatus, number> = { verified: 0, unverified: 1, demo: 2 };

export function findRoute(
  pack: CampusPack,
  fromNodeId: string,
  toNodeId: string,
  profile: RouteProfile = DEFAULT_PROFILE,
): RouteResult {
  const nodes = nodeIndex(pack);
  const start = nodes.get(fromNodeId);
  const goal = nodes.get(toNodeId);
  if (!start || !goal) {
    const missing = !start ? fromNodeId : toNodeId;
    return { ok: false, reason: "unknown-node", message: `Location "${missing}" is not in the campus data.`, blockers: [] };
  }

  const heuristic = (id: string) => {
    const n = nodes.get(id);
    return n ? distance(n, goal) : 0;
  };

  const found = aStar(buildAdjacency(pack, profile), start.id, goal.id, heuristic);
  if (found) return packageRoute(pack, found.nodeIds, found.arcs, profile);

  // Explain WHY: route again respecting only closures, then list what blocks that route.
  const relaxed = aStar(buildAdjacency(pack, { stepFree: false, roles: allRoles(pack) }), start.id, goal.id, heuristic);
  if (!relaxed) {
    return { ok: false, reason: "unreachable", message: "No mapped path connects these two places.", blockers: [] };
  }
  const byReason = new Map<ExclusionReason, Set<string>>();
  for (const arc of relaxed.arcs) {
    for (const r of exclusionReasons(arc.edge, profile)) {
      if (!byReason.has(r)) byReason.set(r, new Set());
      byReason.get(r)!.add(arc.edge.id);
    }
  }
  const blockers = [...byReason].map(([reason, ids]) => ({ reason, edgeIds: [...ids] }));
  return { ok: false, reason: "unreachable", message: describeBlockers(blockers), blockers };
}

/** Route to a point of interest by id. */
export function findRouteToPoi(pack: CampusPack, fromNodeId: string, poiId: string, profile?: RouteProfile): RouteResult {
  const poi = pack.pois.find((p) => p.id === poiId);
  if (!poi) return { ok: false, reason: "unknown-node", message: `Place "${poiId}" is not in the campus data.`, blockers: [] };
  return findRoute(pack, fromNodeId, poi.nodeId, profile);
}

/**
 * Nearest node to a campus-frame position (e.g. a GPS fix converted with latLngToCampus).
 * Restrict to outdoor nodes when snapping GPS — GPS cannot tell which floor you are on.
 */
export function nearestNode(
  pack: CampusPack,
  p: XY,
  opts: { outdoorOnly?: boolean; level?: number } = {},
): { node: NavNode; distanceM: number } | null {
  let best: { node: NavNode; distanceM: number } | null = null;
  for (const n of pack.nodes) {
    if (opts.outdoorOnly && n.indoor) continue;
    if (opts.level !== undefined && n.level !== opts.level) continue;
    const d = distance(n, p);
    if (!best || d < best.distanceM) best = { node: n, distanceM: d };
  }
  return best;
}

function speedOf(profile: RouteProfile): number {
  return profile.walkingSpeedMps ?? DEFAULT_PROFILE.walkingSpeedMps ?? 1.2;
}

function allRoles(pack: CampusPack): string[] {
  const roles = new Set<string>();
  for (const e of pack.edges) for (const r of e.allowedRoles ?? []) roles.add(r);
  return [...roles];
}

function packageRoute(pack: CampusPack, nodeIds: string[], arcs: Arc<NavEdge>[], profile: RouteProfile): RouteSuccess {
  const nodes = nodeIndex(pack);
  const speed = speedOf(profile);
  const legs: RouteLeg[] = arcs.map((arc, i) => ({ edge: arc.edge, from: nodes.get(nodeIds[i])!, to: nodes.get(nodeIds[i + 1])! }));

  let distanceM = 0;
  let durationS = 0;
  let worst: ProvenanceStatus = "verified";
  let hasStepsOrUnknown = false;
  const consider = (s: ProvenanceStatus) => {
    if (STATUS_RANK[s] > STATUS_RANK[worst]) worst = s;
  };

  for (const leg of legs) {
    distanceM += leg.edge.lengthM;
    if (leg.edge.kind === "lift") durationS += LIFT_WAIT_S + leg.edge.lengthM / speed;
    else if (leg.edge.kind === "stairs") durationS += leg.edge.lengthM / (speed * STAIRS_SPEED_FACTOR);
    else durationS += leg.edge.lengthM / speed;
    if (leg.edge.steps !== "none") hasStepsOrUnknown = true;
    consider(leg.edge.provenance.status);
    consider(leg.from.provenance.status);
    consider(leg.to.provenance.status);
  }
  if (legs.length === 0) consider(nodes.get(nodeIds[0])!.provenance.status);

  const buildingNames = new Map(pack.buildings.map((b) => [b.id, b.name]));
  return {
    ok: true,
    nodeIds,
    legs,
    distanceM,
    durationS: Math.round(durationS),
    instructions: buildInstructions(legs, nodes.get(nodeIds[nodeIds.length - 1])!, buildingNames),
    dataStatus: worst,
    hasStepsOrUnknown,
  };
}

export const REASON_LABEL: Record<ExclusionReason, string> = {
  closed: "closed",
  steps: "steps",
  "steps-unknown": "no verified step information",
  "too-steep": "steeper than your limit",
  "slope-unknown": "no verified slope information",
  restricted: "restricted access",
};

function describeBlockers(blockers: Blocker[]): string {
  if (blockers.length === 0) return "No route meets your settings.";
  const parts = blockers.map((b) => `${REASON_LABEL[b.reason]} (${b.edgeIds.length} segment${b.edgeIds.length === 1 ? "" : "s"})`);
  return `No route meets your settings. Blocking the shortest mapped route: ${parts.join("; ")}.`;
}
