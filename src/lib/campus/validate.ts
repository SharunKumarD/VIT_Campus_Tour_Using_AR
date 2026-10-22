/**
 * Campus pack validation (dependency-free).
 *
 * A pack is untrusted input: it may come from a download, IndexedDB or a
 * future admin editor. `validateCampusPack` checks structure AND referential
 * integrity, and `parseCampusPack` turns unknown JSON into a typed pack or
 * rejects it. An invalid pack must never be used for routing.
 */

import type {
  CampusPack,
  EdgeKind,
  NodeKind,
  PoiCategory,
  ProvenanceStatus,
  StepInfo,
  Surface,
} from "./types.ts";
import { distance } from "../routing/geo.ts";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const NODE_KINDS: readonly NodeKind[] = ["intersection", "entrance", "checkpoint", "destination", "stairs", "lift", "ramp"];
const EDGE_KINDS: readonly EdgeKind[] = ["path", "road-crossing", "corridor", "door", "stairs", "ramp", "lift"];
const STEP_INFO: readonly StepInfo[] = ["none", "some", "unknown"];
const SURFACES: readonly Surface[] = ["paved", "unpaved", "tiled", "unknown"];
const PROVENANCE: readonly ProvenanceStatus[] = ["verified", "demo", "unverified"];
const POI_CATEGORIES: readonly PoiCategory[] = [
  "academic", "library", "laboratory", "administration", "hostel",
  "food", "medical", "sports", "student-services", "entrance",
];

/** Allowed slack (metres) when comparing edge length to straight-line distance. */
const LENGTH_TOLERANCE_M = 0.5;

type Rec = Record<string, unknown>;

const isObj = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isInt = (v: unknown): v is number => Number.isInteger(v);
const oneOf = <T extends string>(v: unknown, list: readonly T[]): v is T =>
  typeof v === "string" && (list as readonly string[]).includes(v);

export function validateCampusPack(input: unknown): ValidationResult {
  const errors: string[] = [];
  const err = (m: string) => errors.push(m);

  if (!isObj(input)) return { ok: false, errors: ["Pack is not an object"] };
  const p = input;

  if (p.schemaVersion !== 1) err(`schemaVersion must be 1 (got ${String(p.schemaVersion)})`);
  if (!isStr(p.version)) err("version must be a non-empty string");
  if (!isStr(p.publishedAt) || Number.isNaN(Date.parse(p.publishedAt))) err("publishedAt must be an ISO date string");
  if (!isStr(p.name)) err("name must be a non-empty string");
  if (typeof p.isDemo !== "boolean") err("isDemo must be a boolean");

  if (!isObj(p.origin) || !isNum(p.origin.lat) || !isNum(p.origin.lng)
    || Math.abs(p.origin.lat) > 90 || Math.abs(p.origin.lng) > 180) {
    err("origin must be { lat: -90..90, lng: -180..180 }");
  }

  for (const key of ["buildings", "nodes", "edges", "pois", "checkpoints"] as const) {
    if (!Array.isArray(p[key])) err(`${key} must be an array`);
  }
  if (errors.length > 0) return { ok: false, errors };

  const checkProvenance = (where: string, v: unknown) => {
    if (!isObj(v) || !oneOf(v.status, PROVENANCE) || !isStr(v.source)) {
      err(`${where}: provenance must have status (verified|demo|unverified) and source`);
      return;
    }
    if (v.status === "verified" && !isStr(v.verifiedBy)) err(`${where}: verified data must name verifiedBy`);
    if (v.status === "demo" && p.isDemo !== true) err(`${where}: demo record in a pack with isDemo=false`);
  };

  const checkUnique = (label: string, ids: unknown[]) => {
    const seen = new Set<unknown>();
    for (const id of ids) {
      if (!isStr(id)) err(`${label}: every id must be a non-empty string`);
      else if (seen.has(id)) err(`${label}: duplicate id "${id}"`);
      seen.add(id);
    }
  };

  // Buildings
  const buildings = p.buildings as unknown[];
  const buildingIds = new Set<string>();
  const buildingLevels = new Map<string, Set<number>>();
  checkUnique("buildings", buildings.map((b) => (isObj(b) ? b.id : undefined)));
  buildings.forEach((b, i) => {
    const where = `buildings[${i}]`;
    if (!isObj(b)) return err(`${where} is not an object`);
    if (!isStr(b.name)) err(`${where}: name required`);
    if (!Array.isArray(b.levels) || b.levels.length === 0 || !b.levels.every(isInt)) err(`${where}: levels must be a non-empty integer array`);
    checkProvenance(where, b.provenance);
    if (isStr(b.id)) {
      buildingIds.add(b.id);
      buildingLevels.set(b.id, new Set(Array.isArray(b.levels) ? (b.levels as number[]) : []));
    }
  });

  // Nodes
  const nodes = p.nodes as unknown[];
  const nodeById = new Map<string, { x: number; y: number; level: number; buildingId?: string }>();
  checkUnique("nodes", nodes.map((n) => (isObj(n) ? n.id : undefined)));
  nodes.forEach((n, i) => {
    const where = `nodes[${i}]`;
    if (!isObj(n)) return err(`${where} is not an object`);
    if (!oneOf(n.kind, NODE_KINDS)) err(`${where}: invalid kind "${String(n.kind)}"`);
    if (!isNum(n.x) || !isNum(n.y)) err(`${where}: x and y must be finite numbers (metres)`);
    if (!isInt(n.level)) err(`${where}: level must be an integer`);
    if (typeof n.indoor !== "boolean") err(`${where}: indoor must be a boolean`);
    if (n.buildingId !== undefined) {
      if (!isStr(n.buildingId) || !buildingIds.has(n.buildingId)) err(`${where}: unknown buildingId "${String(n.buildingId)}"`);
      else if (isInt(n.level) && !buildingLevels.get(n.buildingId)?.has(n.level)) err(`${where}: level ${n.level} not in building ${n.buildingId}`);
    }
    if (n.indoor === true && n.buildingId === undefined) err(`${where}: indoor nodes must have a buildingId`);
    checkProvenance(where, n.provenance);
    if (isStr(n.id) && isNum(n.x) && isNum(n.y) && isInt(n.level)) {
      nodeById.set(n.id, { x: n.x, y: n.y, level: n.level, buildingId: isStr(n.buildingId) ? n.buildingId : undefined });
    }
  });

  // Edges
  const edges = p.edges as unknown[];
  checkUnique("edges", edges.map((e) => (isObj(e) ? e.id : undefined)));
  edges.forEach((e, i) => {
    const where = `edges[${i}]${isObj(e) && isStr(e.id) ? ` (${e.id})` : ""}`;
    if (!isObj(e)) return err(`${where} is not an object`);
    if (!oneOf(e.kind, EDGE_KINDS)) err(`${where}: invalid kind "${String(e.kind)}"`);
    if (!oneOf(e.steps, STEP_INFO)) err(`${where}: steps must be none|some|unknown`);
    if (!oneOf(e.surface, SURFACES)) err(`${where}: invalid surface`);
    if (typeof e.bidirectional !== "boolean") err(`${where}: bidirectional must be a boolean`);
    if (!isNum(e.lengthM) || e.lengthM <= 0) err(`${where}: lengthM must be a positive number`);
    if (e.slopePct !== undefined && (!isNum(e.slopePct) || e.slopePct < 0)) err(`${where}: slopePct must be >= 0 when present`);
    if (e.allowedRoles !== undefined && (!Array.isArray(e.allowedRoles) || e.allowedRoles.length === 0 || !e.allowedRoles.every(isStr))) {
      err(`${where}: allowedRoles must be a non-empty string array when present`);
    }
    if (e.kind === "lift" && e.steps !== "none") err(`${where}: a lift edge must have steps "none"`);
    if (e.kind === "stairs" && e.steps === "none") err(`${where}: a stairs edge cannot have steps "none"`);
    checkProvenance(where, e.provenance);

    const a = isStr(e.from) ? nodeById.get(e.from) : undefined;
    const b = isStr(e.to) ? nodeById.get(e.to) : undefined;
    if (!a) err(`${where}: unknown from node "${String(e.from)}"`);
    if (!b) err(`${where}: unknown to node "${String(e.to)}"`);
    if (e.from === e.to) err(`${where}: self-loop`);
    if (a && b && isNum(e.lengthM)) {
      const straight = distance(a, b);
      if (e.lengthM + LENGTH_TOLERANCE_M < straight) {
        err(`${where}: lengthM ${e.lengthM} is shorter than straight-line distance ${straight.toFixed(1)} m`);
      }
      if (a.level !== b.level && !["stairs", "lift", "ramp"].includes(String(e.kind))) {
        err(`${where}: edge changes level (${a.level}→${b.level}) but kind is "${String(e.kind)}"`);
      }
    }
  });

  // POIs
  const pois = p.pois as unknown[];
  checkUnique("pois", pois.map((x) => (isObj(x) ? x.id : undefined)));
  pois.forEach((poi, i) => {
    const where = `pois[${i}]`;
    if (!isObj(poi)) return err(`${where} is not an object`);
    if (!isStr(poi.name)) err(`${where}: name required`);
    if (!oneOf(poi.category, POI_CATEGORIES)) err(`${where}: invalid category`);
    if (!isStr(poi.nodeId) || !nodeById.has(poi.nodeId)) err(`${where}: unknown nodeId "${String(poi.nodeId)}"`);
    if (poi.accessibleEntranceNodeId !== undefined && (!isStr(poi.accessibleEntranceNodeId) || !nodeById.has(poi.accessibleEntranceNodeId))) {
      err(`${where}: unknown accessibleEntranceNodeId`);
    }
    if (poi.aliases !== undefined && (!Array.isArray(poi.aliases) || !poi.aliases.every(isStr))) err(`${where}: aliases must be strings`);
    checkProvenance(where, poi.provenance);
  });

  // Checkpoints
  const checkpoints = p.checkpoints as unknown[];
  checkUnique("checkpoints", checkpoints.map((c) => (isObj(c) ? c.id : undefined)));
  const payloads = new Set<string>();
  checkpoints.forEach((c, i) => {
    const where = `checkpoints[${i}]`;
    if (!isObj(c)) return err(`${where} is not an object`);
    if (!isStr(c.markerPayload)) err(`${where}: markerPayload required`);
    else {
      if (/^[a-z][a-z0-9+.-]*:/i.test(c.markerPayload)) err(`${where}: markerPayload must be an opaque ID, not a URL/URI`);
      if (payloads.has(c.markerPayload)) err(`${where}: duplicate markerPayload`);
      payloads.add(c.markerPayload);
    }
    const node = isStr(c.nodeId) ? nodeById.get(c.nodeId) : undefined;
    if (!node) err(`${where}: unknown nodeId "${String(c.nodeId)}"`);
    if (!isStr(c.buildingId) || !buildingIds.has(c.buildingId)) err(`${where}: unknown buildingId`);
    if (!isInt(c.level)) err(`${where}: level must be an integer`);
    if (node && (node.level !== c.level || node.buildingId !== c.buildingId)) err(`${where}: building/level do not match its node`);
    if (!isNum(c.facingDeg) || c.facingDeg < 0 || c.facingDeg >= 360) err(`${where}: facingDeg must be in [0, 360)`);
    if (!isInt(c.markerVersion) || (c.markerVersion as number) < 1) err(`${where}: markerVersion must be a positive integer`);
    checkProvenance(where, c.provenance);
  });

  return { ok: errors.length === 0, errors };
}

export class CampusPackError extends Error {
  readonly errors: string[];
  constructor(errors: string[]) {
    super(`Invalid campus pack (${errors.length} problem${errors.length === 1 ? "" : "s"}): ${errors.slice(0, 3).join("; ")}`);
    this.name = "CampusPackError";
    this.errors = errors;
  }
}

/** Validate unknown JSON and return it as a typed pack, or throw CampusPackError. */
export function parseCampusPack(input: unknown): CampusPack {
  const result = validateCampusPack(input);
  if (!result.ok) throw new CampusPackError(result.errors);
  return input as CampusPack;
}
