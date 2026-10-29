/**
 * Outdoor AR guidance to a building, reusing the native ARCore guidance screen.
 *
 * The phone's GPS fix becomes the start "checkpoint" and the phone's compass
 * heading (read with the phone held flat, pointing the way the user faces)
 * becomes its facing direction. The AR screen then anchors arrows on the
 * ground along the straight line to the building.
 *
 * Honest limits: GPS (±5–15 m) and compass (±5–15°) errors both apply, so the
 * line is approximate; the payload uses policy "always" because the AR drift
 * limits (40/80 m) are shorter than most outdoor walks.
 */

import type { NavPayload } from "../native/nav-payload.ts";
import { NAV_PAYLOAD_VERSION } from "../native/nav-payload.ts";
import { bearingDeg, distanceM, type LatLng } from "./geo.ts";

export const OUTDOOR_STEP_M = 10;
export const OUTDOOR_MAX_M = 1500;

export function buildOutdoorPayload(from: LatLng, to: LatLng, headingDeg: number, destinationName: string): NavPayload {
  if (!Number.isFinite(headingDeg)) throw new Error("No compass direction yet. Hold the phone flat for a moment.");
  const d = distanceM(from, to);
  if (d < 5) throw new Error("You are already there.");
  if (d > OUTDOOR_MAX_M) throw new Error("This place is too far away for AR guidance. Use Google Maps first.");
  const b = (bearingDeg(from, to) * Math.PI) / 180;
  const n = Math.max(1, Math.ceil(d / OUTDOOR_STEP_M));
  const nodes: NavPayload["nodes"] = [];
  for (let i = 0; i <= n; i++) {
    const s = (d * i) / n;
    nodes.push({
      id: i === 0 ? "here" : i === n ? "dest" : `p${i}`,
      x: +(s * Math.sin(b)).toFixed(2),
      y: +(s * Math.cos(b)).toFixed(2),
      level: 0,
      landmark: i === 0 ? "where you are standing" : i === n ? destinationName : "",
    });
  }
  const facing = ((Math.round(headingDeg) % 360) + 360) % 360;
  return {
    version: NAV_PAYLOAD_VERSION,
    policy: "always",
    destinationName,
    startCheckpointId: "cp-here",
    nodes,
    instructions: [
      { text: `Walk towards ${destinationName}, about ${Math.round(d)} m. Keep to the footpaths.`, atNodeId: "here", type: "depart" },
      { text: `You have reached ${destinationName}.`, atNodeId: "dest", type: "arrive" },
    ],
    checkpoints: [{ id: "cp-here", nodeId: "here", name: "where you are standing", marker: "", x: 0, y: 0, level: 0, facingDeg: facing }],
  };
}
