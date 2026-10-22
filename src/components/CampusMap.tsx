"use client";

/**
 * Offline campus map drawn as SVG straight from the route graph.
 * No map tiles, no API key, no network. North is up.
 *
 * It shows ground-level (level 0) paths only; upper floors are reached
 * through the step list. A tiled basemap (MapLibre) can be layered under
 * this later once real, authorised campus geometry exists.
 */

import { useMemo, type ReactNode } from "react";
import type { CampusPack, NavEdge, NavNode } from "@/lib/campus/types.ts";
import type { RouteSuccess } from "@/lib/routing/index.ts";
import { fitViewport, niceScale } from "@/lib/map/projection.ts";

interface Props {
  pack: CampusPack;
  route?: RouteSuccess | null;
  selectedPoiId?: string | null;
  onSelectPoi?: (poiId: string) => void;
  /** Accessible description of what the map currently shows. */
  label: string;
}

const shortName = (name: string) => name.replace(/^Demo /, "").replace(/\s*\(.*\)$/, "");

function edgeStyle(e: NavEdge): { stroke: string; dash?: string; width: number } {
  if (e.closed) return { stroke: "var(--color-danger)", dash: "2 4", width: 3 };
  if (e.allowedRoles?.length) return { stroke: "#d3aaa3", dash: "1 5", width: 4 };
  if (e.steps === "some") return { stroke: "#9aa89f", dash: "5 4", width: 4 };
  if (e.steps === "unknown") return { stroke: "#b0bab3", dash: "1 4", width: 4 };
  return { stroke: "#c4cec7", width: 6 };
}

export function CampusMap({ pack, route, selectedPoiId, onSelectPoi, label }: Props) {
  const nodes = useMemo(() => new Map(pack.nodes.map((n) => [n.id, n])), [pack]);
  const vp = useMemo(() => fitViewport(pack.nodes, 360, 34), [pack]);

  const buildings = useMemo(
    () =>
      pack.buildings.map((b) => {
        const own = pack.nodes.filter((n) => n.buildingId === b.id);
        const pts = own.map((n) => vp.project(n));
        const pad = 12;
        const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
        return {
          id: b.id,
          name: shortName(b.name),
          x: Math.min(...xs) - pad,
          y: Math.min(...ys) - pad,
          w: Math.max(...xs) - Math.min(...xs) + 2 * pad,
          h: Math.max(...ys) - Math.min(...ys) + 2 * pad,
        };
      }),
    [pack, vp],
  );

  const ground = (n: NavNode | undefined): n is NavNode => !!n && n.level === 0;

  const routePoints = route
    ? route.nodeIds.map((id) => nodes.get(id)).filter(ground).map((n) => vp.project(n))
    : [];
  const routePath = routePoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const start = route ? nodes.get(route.nodeIds[0]) : undefined;
  const end = route ? nodes.get(route.nodeIds[route.nodeIds.length - 1]) : undefined;

  const scaleM = niceScale(vp.metresPerUnit * 80);
  const scaleLen = scaleM / vp.metresPerUnit;

  return (
    <svg
      viewBox={`0 0 ${vp.width} ${vp.height}`}
      className="block h-auto w-full select-none"
      role="img"
      aria-label={label}
    >
      <rect width={vp.width} height={vp.height} fill="#e9eee9" />

      {buildings.map((b) => (
        <g key={b.id}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={6} fill="#d7dfd8" stroke="#bfcac2" />
        </g>
      ))}

      {pack.edges.map((e) => {
        const a = nodes.get(e.from), b = nodes.get(e.to);
        if (!ground(a) || !ground(b)) return null;
        const p = vp.project(a), q = vp.project(b);
        const s = edgeStyle(e);
        return (
          <line key={e.id} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={s.stroke} strokeWidth={s.width}
            strokeDasharray={s.dash} strokeLinecap="round" />
        );
      })}

      {routePath ? (
        <>
          <path d={routePath} fill="none" stroke="var(--color-route-ink)" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
          <path d={routePath} fill="none" stroke="var(--color-route)" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}

      {pack.pois.map((poi) => {
        const n = nodes.get(poi.nodeId);
        if (!n) return null;
        const p = vp.project(n);
        const selected = poi.id === selectedPoiId || poi.nodeId === end?.id;
        const interactive = !!onSelectPoi;
        const labelLeft = p.x > vp.width * 0.62;
        return (
          <g
            key={poi.id}
            transform={`translate(${p.x} ${p.y})`}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={interactive ? `${poi.name}${n.level ? `, floor ${n.level}` : ""}` : undefined}
            onClick={interactive ? () => onSelectPoi(poi.id) : undefined}
            onKeyDown={interactive ? (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onSelectPoi(poi.id); } } : undefined}
            className={interactive ? "cursor-pointer" : undefined}
          >
            {interactive ? <circle r={18} fill="transparent" /> : null}
            <circle r={selected ? 8 : 6} fill={selected ? "var(--color-sign)" : "#fff"} stroke="var(--color-sign)" strokeWidth={2.5} />
            {n.level !== 0 ? <text x={0} y={3} textAnchor="middle" fontSize={7} fontWeight={700} fill={selected ? "#fff" : "var(--color-sign)"}>{n.level}</text> : null}
            <text
              x={labelLeft ? -11 : 11}
              y={4}
              textAnchor={labelLeft ? "end" : "start"}
              fontSize={11}
              fontWeight={selected ? 700 : 600}
              fill="var(--color-ink)"
              stroke="#e9eee9"
              strokeWidth={3.5}
              paintOrder="stroke"
            >
              {shortName(poi.name)}
            </text>
          </g>
        );
      })}

      {start && ground(start) ? (
        <g transform={`translate(${vp.project(start).x} ${vp.project(start).y})`} aria-hidden>
          <circle r={9} fill="var(--color-access)" stroke="#fff" strokeWidth={3} />
        </g>
      ) : null}

      <g transform={`translate(${vp.width - 22} 22)`} aria-hidden>
        <circle r={13} fill="#fff" stroke="#c4cec7" />
        <path d="M0 -8 L5 4 L0 1 L-5 4 Z" fill="var(--color-ink)" />
        <text y={-15} textAnchor="middle" fontSize={8} fontWeight={700} fill="var(--color-muted)">N</text>
      </g>

      <g transform={`translate(14 ${vp.height - 14})`} aria-hidden>
        <path d={`M0 -5 V0 H${scaleLen} V-5`} fill="none" stroke="var(--color-ink)" strokeWidth={1.5} />
        <text x={scaleLen + 6} y={0} fontSize={9} fill="var(--color-ink)">{scaleM} m</text>
      </g>
    </svg>
  );
}

export function MapLegend({ showRoute }: { showRoute: boolean }) {
  const item = (swatch: ReactNode, text: string) => (
    <li className="flex items-center gap-2">
      <svg width="28" height="10" aria-hidden>{swatch}</svg>
      {text}
    </li>
  );
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted">
      {showRoute ? item(<line x1="2" y1="5" x2="26" y2="5" stroke="var(--color-route)" strokeWidth="5" strokeLinecap="round" />, "Your route") : null}
      {item(<line x1="2" y1="5" x2="26" y2="5" stroke="#c4cec7" strokeWidth="5" strokeLinecap="round" />, "Step-free path")}
      {item(<line x1="2" y1="5" x2="26" y2="5" stroke="#9aa89f" strokeWidth="3" strokeDasharray="5 4" />, "Path with steps")}
      {item(<line x1="2" y1="5" x2="26" y2="5" stroke="#b0bab3" strokeWidth="3" strokeDasharray="1 4" strokeLinecap="round" />, "Steps not surveyed")}
      {item(<line x1="2" y1="5" x2="26" y2="5" stroke="#d3aaa3" strokeWidth="3" strokeDasharray="1 5" strokeLinecap="round" />, "Restricted")}
    </ul>
  );
}
