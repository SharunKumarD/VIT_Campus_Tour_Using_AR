/** Public API of the routing engine. Import from "@/lib/routing". */
export { findRoute, findRouteToPoi, nearestNode, buildAdjacency, REASON_LABEL, LIFT_WAIT_S, STAIRS_SPEED_FACTOR } from "./route.ts";
export type { RouteResult, RouteSuccess, RouteFailure, RouteLeg, Blocker } from "./route.ts";
export { DEFAULT_PROFILE, STEP_FREE_PROFILE, exclusionReasons, costFactor } from "./profile.ts";
export type { RouteProfile, ExclusionReason } from "./profile.ts";
export { formatDistance } from "./instructions.ts";
export type { Instruction, InstructionType } from "./instructions.ts";
export { campusToLatLng, latLngToCampus, distance, bearing, turnAngle } from "./geo.ts";
export type { LatLng, XY } from "./geo.ts";
export { aStar } from "./astar.ts";
