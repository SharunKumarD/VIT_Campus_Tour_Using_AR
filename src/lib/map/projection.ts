/**
 * Projects campus-frame metres (x east, y north) into SVG coordinates
 * (x right, y DOWN), preserving aspect ratio, with north up.
 */

import type { XY } from "../routing/geo.ts";

export interface Viewport {
  /** SVG viewBox width and height. */
  width: number;
  height: number;
  project: (p: XY) => XY;
  /** Metres represented by one SVG unit. */
  metresPerUnit: number;
}

export function fitViewport(points: readonly XY[], width = 360, padding = 28): Viewport {
  if (points.length === 0) {
    return { width, height: width, project: () => ({ x: width / 2, y: width / 2 }), metresPerUnit: 1 };
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const scale = (width - 2 * padding) / spanX;
  const height = Math.round(spanY * scale + 2 * padding);
  return {
    width,
    height,
    metresPerUnit: 1 / scale,
    project: (p) => ({ x: padding + (p.x - minX) * scale, y: padding + (maxY - p.y) * scale }),
  };
}

/** A "nice" scale-bar length in metres (1, 2, 5 × 10^n) close to `target`. */
export function niceScale(target: number): number {
  if (target <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(target));
  const f = target / pow;
  const nice = f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10;
  return nice * pow;
}
