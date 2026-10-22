/**
 * A* shortest path over a directed adjacency list.
 *
 * Correctness requires: every arc cost >= 0, and heuristic(n) <= true
 * remaining cost (admissible). Our campus heuristic is straight-line distance,
 * which is admissible because validation enforces edge length >= straight-line
 * distance and every cost factor is >= 1.
 */

export interface Arc<E> {
  to: string;
  cost: number;
  edge: E;
}

export type Adjacency<E> = ReadonlyMap<string, readonly Arc<E>[]>;

export interface AStarResult<E> {
  nodeIds: string[];
  arcs: Arc<E>[];
  cost: number;
}

/** Minimal binary min-heap keyed by priority. */
class MinHeap<T> {
  private items: { p: number; v: T }[] = [];

  get size(): number {
    return this.items.length;
  }

  push(v: T, p: number): void {
    const a = this.items;
    a.push({ p, v });
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (a[parent].p <= a[i].p) break;
      [a[parent], a[i]] = [a[i], a[parent]];
      i = parent;
    }
  }

  pop(): T | undefined {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0].v;
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].p < a[m].p) m = l;
        if (r < a.length && a[r].p < a[m].p) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

export function aStar<E>(
  adjacency: Adjacency<E>,
  start: string,
  goal: string,
  heuristic: (nodeId: string) => number,
): AStarResult<E> | null {
  if (start === goal) return { nodeIds: [start], arcs: [], cost: 0 };

  const g = new Map<string, number>([[start, 0]]);
  const cameFrom = new Map<string, { prev: string; arc: Arc<E> }>();
  const closed = new Set<string>();
  const open = new MinHeap<string>();
  open.push(start, heuristic(start));

  while (open.size > 0) {
    const current = open.pop()!;
    if (closed.has(current)) continue; // stale heap entry
    if (current === goal) {
      const nodeIds: string[] = [goal];
      const arcs: Arc<E>[] = [];
      let n = goal;
      while (n !== start) {
        const step = cameFrom.get(n)!;
        arcs.push(step.arc);
        nodeIds.push(step.prev);
        n = step.prev;
      }
      nodeIds.reverse();
      arcs.reverse();
      return { nodeIds, arcs, cost: g.get(goal)! };
    }
    closed.add(current);

    const gCurrent = g.get(current)!;
    for (const arc of adjacency.get(current) ?? []) {
      if (closed.has(arc.to)) continue;
      const tentative = gCurrent + arc.cost;
      const known = g.get(arc.to);
      if (known === undefined || tentative < known) {
        g.set(arc.to, tentative);
        cameFrom.set(arc.to, { prev: current, arc });
        open.push(arc.to, tentative + heuristic(arc.to));
      }
    }
  }
  return null;
}
