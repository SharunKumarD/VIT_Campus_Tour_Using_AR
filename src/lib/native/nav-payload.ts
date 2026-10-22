/**
 * Builds the route message sent to the native AR guidance screen
 * (parsed by android/.../ar/NavPayload.java — keep the two in step).
 *
 * The route is computed HERE by the shared routing engine; the AR screen
 * only follows it. AR guidance must start at a checkpoint, because that is
 * how the AR world is lined up with the campus map.
 */

import type { CampusPack, Checkpoint } from "../campus/types.ts";
import type { RouteSuccess } from "../routing/route.ts";

export const NAV_PAYLOAD_VERSION = 1;

export interface NavPayload {
  version: typeof NAV_PAYLOAD_VERSION;
  destinationName: string;
  startCheckpointId: string;
  nodes: { id: string; x: number; y: number; level: number; landmark: string }[];
  instructions: { text: string; atNodeId: string; type: string }[];
  checkpoints: { id: string; nodeId: string; name: string; x: number; y: number; level: number; facingDeg: number }[];
}

/** Human name for a checkpoint: its node's landmark, else its id. */
export function checkpointName(pack: CampusPack, cp: Checkpoint): string {
  return pack.nodes.find((n) => n.id === cp.nodeId)?.landmark ?? cp.id;
}

export function buildNavPayload(
  pack: CampusPack,
  route: RouteSuccess,
  start: Checkpoint,
  destinationName: string,
): NavPayload {
  if (route.nodeIds[0] !== start.nodeId) {
    throw new Error("AR guidance must start at the chosen checkpoint");
  }
  const byId = new Map(pack.nodes.map((n) => [n.id, n]));
  const onRoute = new Set(route.nodeIds);
  return {
    version: NAV_PAYLOAD_VERSION,
    destinationName: destinationName.replace(/^Demo /, ""),
    startCheckpointId: start.id,
    nodes: route.nodeIds.map((id) => {
      const n = byId.get(id)!;
      return { id, x: n.x, y: n.y, level: n.level, landmark: n.landmark ?? "" };
    }),
    instructions: route.instructions.map((i) => ({ text: i.text, atNodeId: i.atNodeId, type: i.type })),
    checkpoints: pack.checkpoints
      .filter((c) => onRoute.has(c.nodeId))
      .map((c) => {
        const n = byId.get(c.nodeId)!;
        return { id: c.id, nodeId: c.nodeId, name: checkpointName(pack, c), x: n.x, y: n.y, level: c.level, facingDeg: c.facingDeg };
      }),
  };
}
