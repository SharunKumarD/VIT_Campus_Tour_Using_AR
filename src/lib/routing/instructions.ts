/**
 * Turn-by-turn text instructions from a computed route.
 *
 * These double as the "landmark guidance" fallback mode when neither AR
 * nor the map can be trusted (plan section 6): they reference landmarks,
 * not coordinates.
 */

import type { NavEdge, NavNode } from "../campus/types.ts";
import { bearing, turnAngle } from "./geo.ts";

export type InstructionType = "depart" | "turn" | "continue" | "steps" | "ramp" | "lift" | "stairs" | "enter" | "exit" | "arrive";

export interface Instruction {
  type: InstructionType;
  text: string;
  /** Metres covered by this instruction (0 for arrive / enter / exit). */
  distanceM: number;
  /** Node where the instruction starts — used to show it on the map / in AR. */
  atNodeId: string;
}

interface Leg {
  edge: NavEdge;
  from: NavNode;
  to: NavNode;
}

/** Turns smaller than this (degrees) are treated as "keep going". */
const STRAIGHT_DEG = 30;

const CARDINALS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];

function cardinal(deg: number): string {
  return CARDINALS[Math.round(deg / 45) % 8];
}

function turnPhrase(angle: number): string {
  const a = Math.abs(angle);
  const side = angle > 0 ? "right" : "left";
  if (a < 60) return `Bear ${side}`;
  if (a <= 135) return `Turn ${side}`;
  return `Make a sharp ${side}`;
}

export function formatDistance(m: number): string {
  if (m < 20) return `${Math.max(1, Math.round(m))} m`;
  if (m < 1000) return `${Math.round(m / 5) * 5} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function floorName(level: number): string {
  if (level === 0) return "the ground floor";
  if (level < 0) return `basement ${-level}`;
  return `floor ${level}`;
}

const landmark = (n: NavNode) => n.landmark ?? "the next junction";

type Mode = "walk" | "stepped" | "steps" | "ramp";

const modeOf = (e: NavEdge): Mode => {
  if (e.kind === "stairs") return "steps";
  if (e.kind === "ramp") return "ramp";
  if (e.steps === "some") return "stepped"; // a path that includes some steps
  return "walk";
};

function describe(mode: Mode, d: string): string {
  switch (mode) {
    case "steps": return `take the steps (${d})`;
    case "ramp": return `take the ramp (${d})`;
    case "stepped": return `walk ${d} along a path with steps`;
    default: return `walk ${d}`;
  }
}

export function buildInstructions(legs: Leg[], destination: NavNode, buildingNames: ReadonlyMap<string, string>): Instruction[] {
  const out: Instruction[] = [];

  // Current horizontal segment being accumulated.
  let seg: { mode: Mode; start: NavNode; distanceM: number; turn: number | null; heading: number } | null = null;
  let lastHeading: number | null = null;
  let first = true;

  const flush = () => {
    if (!seg) return;
    const d = formatDistance(seg.distanceM);
    const body = describe(seg.mode, d);
    const walkish = seg.mode === "walk" || seg.mode === "stepped";
    let text: string;
    let type: InstructionType;
    if (first) {
      type = "depart";
      text = `Head ${cardinal(seg.heading)} from ${landmark(seg.start)} and ${body}`;
      first = false;
    } else if (seg.turn !== null && Math.abs(seg.turn) >= STRAIGHT_DEG) {
      type = walkish ? "turn" : (seg.mode as "steps" | "ramp");
      text = `${turnPhrase(seg.turn)} at ${landmark(seg.start)}, then ${body}`;
    } else {
      type = walkish ? "continue" : (seg.mode as "steps" | "ramp");
      text = body.charAt(0).toUpperCase() + body.slice(1);
    }
    out.push({ type, text, distanceM: seg.distanceM, atNodeId: seg.start.id });
    seg = null;
  };

  for (const leg of legs) {
    const { edge, from, to } = leg;

    // Vertical movement: lift or stairs between floors.
    if (from.level !== to.level) {
      flush();
      first = false;
      const up = to.level > from.level;
      if (edge.kind === "lift") {
        out.push({ type: "lift", text: `Take the lift to ${floorName(to.level)}`, distanceM: edge.lengthM, atNodeId: from.id });
      } else {
        out.push({ type: "stairs", text: `Take the stairs ${up ? "up" : "down"} to ${floorName(to.level)}`, distanceM: edge.lengthM, atNodeId: from.id });
      }
      lastHeading = null; // orientation is lost after changing floors
      continue;
    }

    // Entering or leaving a building.
    if (from.indoor !== to.indoor) {
      flush();
      const bId = to.indoor ? to.buildingId : from.buildingId;
      const name = (bId && buildingNames.get(bId)) || "the building";
      out.push(to.indoor
        ? { type: "enter", text: `Enter ${name} at ${landmark(from)}`, distanceM: 0, atNodeId: from.id }
        : { type: "exit", text: `Leave ${name} at ${landmark(from)}`, distanceM: 0, atNodeId: from.id });
      if (first) first = false;
      lastHeading = null;
    }

    const h = bearing(from, to);
    const mode = modeOf(edge);
    const turn = lastHeading === null || Number.isNaN(h) ? null : turnAngle(lastHeading, h);
    const straight = turn === null || Math.abs(turn) < STRAIGHT_DEG;

    if (seg && seg.mode === mode && mode === "walk" && straight) {
      seg.distanceM += edge.lengthM;
    } else {
      flush();
      seg = { mode, start: from, distanceM: edge.lengthM, turn, heading: Number.isNaN(h) ? 0 : h };
    }
    if (!Number.isNaN(h)) lastHeading = h;
  }
  flush();

  out.push({ type: "arrive", text: `Arrive at ${landmark(destination)}`, distanceM: 0, atNodeId: destination.id });
  return out;
}
