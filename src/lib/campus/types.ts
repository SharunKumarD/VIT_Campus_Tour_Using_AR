/**
 * VIT ImmersiveAR — campus data model.
 *
 * Coordinate convention (see Phase 0–1 plan, section 6):
 *   - Every node has a position in the CAMPUS frame: x = metres east,
 *     y = metres north of the pack's `origin` (a WGS84 lat/lng).
 *   - `level` is the floor: 0 = ground / outdoors, 1 = first floor, -1 = basement.
 *   - Lat/lng for a node is derived from origin + (x, y) — see routing/geo.ts.
 *
 * Every record carries `provenance` so demonstration data can never be
 * mistaken for verified campus data. The UI must badge anything not "verified".
 */

export type ProvenanceStatus = "verified" | "demo" | "unverified";

export interface Provenance {
  status: ProvenanceStatus;
  /** Where the data came from, e.g. "VIT Estate Office floor plan 2026-11" or "synthetic demo". */
  source: string;
  verifiedBy?: string;
  /** ISO date, e.g. "2026-11-02". */
  verifiedAt?: string;
}

export type NodeKind =
  | "intersection"
  | "entrance"
  | "checkpoint"
  | "destination"
  | "stairs"
  | "lift"
  | "ramp";

export interface NavNode {
  id: string;
  kind: NodeKind;
  /** Metres east of the pack origin. */
  x: number;
  /** Metres north of the pack origin. */
  y: number;
  /** Floor number. 0 = ground / outdoors. */
  level: number;
  indoor: boolean;
  buildingId?: string;
  /** Short human landmark used in text guidance, e.g. "lift lobby". */
  landmark?: string;
  provenance: Provenance;
}

export type EdgeKind = "path" | "road-crossing" | "corridor" | "door" | "stairs" | "ramp" | "lift";

/** Tri-state step information. "unknown" is NEVER treated as step-free. */
export type StepInfo = "none" | "some" | "unknown";

export type Surface = "paved" | "unpaved" | "tiled" | "unknown";

export interface NavEdge {
  id: string;
  from: string;
  to: string;
  bidirectional: boolean;
  kind: EdgeKind;
  /**
   * Walking length in metres. Must be >= the straight-line distance between
   * the two nodes (the A* heuristic relies on this; validation enforces it).
   */
  lengthM: number;
  steps: StepInfo;
  /** Maximum slope in percent. Undefined = unknown (excluded when a slope limit is set). */
  slopePct?: number;
  surface: Surface;
  covered?: boolean;
  /**
   * If set, only users holding one of these roles may use this edge
   * (e.g. ["hostel-resident"]). Restricted edges are never used otherwise.
   */
  allowedRoles?: string[];
  /** Temporarily closed (construction, event). Never routed. */
  closed?: boolean;
  provenance: Provenance;
}

export type PoiCategory =
  | "academic"
  | "library"
  | "laboratory"
  | "administration"
  | "hostel"
  | "food"
  | "medical"
  | "sports"
  | "student-services"
  | "entrance";

export interface Poi {
  id: string;
  name: string;
  category: PoiCategory;
  /** The graph node users are routed to. */
  nodeId: string;
  /** Optional separate step-free entrance node, if verified. */
  accessibleEntranceNodeId?: string;
  description?: string;
  /** Search aliases, e.g. ["central library", "books"]. */
  aliases?: string[];
  provenance: Provenance;
}

export interface Checkpoint {
  id: string;
  /** Exact text encoded in the printed QR code / marker. Never a URL to open. */
  markerPayload: string;
  nodeId: string;
  /** Building the marker is in. Omitted for outdoor markers (e.g. at a gate). */
  buildingId?: string;
  level: number;
  /** Direction the user faces when scanning the marker, degrees clockwise from north. */
  facingDeg: number;
  markerVersion: number;
  provenance: Provenance;
}

export interface Building {
  id: string;
  name: string;
  levels: number[];
  provenance: Provenance;
}

export interface CampusPack {
  /** Data schema version this pack follows. */
  schemaVersion: 1;
  /** Content version, e.g. "demo-2026.10.23". Shown in the Offline screen. */
  version: string;
  /** ISO timestamp the pack was published. */
  publishedAt: string;
  name: string;
  /** True if ANY part of the pack is synthetic demonstration data. */
  isDemo: boolean;
  origin: { lat: number; lng: number };
  buildings: Building[];
  nodes: NavNode[];
  edges: NavEdge[];
  pois: Poi[];
  checkpoints: Checkpoint[];
}
