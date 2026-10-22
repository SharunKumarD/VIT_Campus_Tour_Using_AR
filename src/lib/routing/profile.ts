/**
 * Route profiles: hard constraints (filters) and soft preferences (penalties).
 *
 * Hard constraints REMOVE edges from the graph, so a route can never use a
 * prohibited edge — mode changes in the AR layer cannot change this either.
 * Soft preferences only multiply an edge's cost by a factor >= 1, which keeps
 * the A* heuristic admissible.
 *
 * Unknown data is treated conservatively: under a step-free profile an edge
 * with steps "unknown" is excluded, and under a slope limit an edge with
 * unknown slope is excluded. The app must say so rather than guess.
 */

import type { NavEdge } from "../campus/types.ts";

export interface RouteProfile {
  /** Hard: exclude any edge whose steps are not verified "none". */
  stepFree: boolean;
  /** Hard: exclude edges steeper than this, and edges with unknown slope. */
  maxSlopePct?: number;
  /** Roles the user holds, for restricted edges (e.g. "hostel-resident"). */
  roles?: readonly string[];
  /** Soft: unpaved / unknown surfaces cost 1.5x. */
  avoidUnpaved?: boolean;
  /** Soft: uncovered edges cost 1.2x (sun / rain). */
  preferCovered?: boolean;
  /** Metres per second on level ground. Default 1.2. */
  walkingSpeedMps?: number;
}

export const DEFAULT_PROFILE: RouteProfile = {
  stepFree: false,
  walkingSpeedMps: 1.2,
};

/**
 * Step-free profile. 8.33 % (1:12) is a common maximum ramp gradient in
 * accessibility guidance; it is a starting value to confirm with users and
 * local standards, not a guarantee of wheelchair accessibility.
 */
export const STEP_FREE_PROFILE: RouteProfile = {
  stepFree: true,
  maxSlopePct: 8.33,
  walkingSpeedMps: 0.9,
};

export type ExclusionReason =
  | "closed"
  | "steps"
  | "steps-unknown"
  | "too-steep"
  | "slope-unknown"
  | "restricted";

/** All reasons this profile forbids the edge. Empty array = allowed. */
export function exclusionReasons(edge: NavEdge, profile: RouteProfile): ExclusionReason[] {
  const reasons: ExclusionReason[] = [];
  if (edge.closed) reasons.push("closed");
  if (profile.stepFree) {
    if (edge.steps === "some") reasons.push("steps");
    else if (edge.steps === "unknown") reasons.push("steps-unknown");
  }
  if (profile.maxSlopePct !== undefined) {
    if (edge.slopePct === undefined) reasons.push("slope-unknown");
    else if (edge.slopePct > profile.maxSlopePct) reasons.push("too-steep");
  }
  if (edge.allowedRoles && edge.allowedRoles.length > 0) {
    const roles = profile.roles ?? [];
    if (!edge.allowedRoles.some((r) => roles.includes(r))) reasons.push("restricted");
  }
  return reasons;
}

/** Cost multiplier for soft preferences. Always >= 1. */
export function costFactor(edge: NavEdge, profile: RouteProfile): number {
  let f = 1;
  if (profile.avoidUnpaved && (edge.surface === "unpaved" || edge.surface === "unknown")) f *= 1.5;
  if (profile.preferCovered && !edge.covered && !["corridor", "lift", "door"].includes(edge.kind)) f *= 1.2;
  return f;
}
