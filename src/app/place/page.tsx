"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { CampusMap, MapLegend } from "@/components/CampusMap.tsx";
import { DataNotice, StatusPill } from "@/components/DataNotice.tsx";
import { AccessIcon, CategoryIcon, MapIcon, SwapIcon } from "@/components/icons.tsx";
import { PageHeader } from "@/components/PageHeader.tsx";
import { DEFAULT_START_POI_ID, getCampusPack, getPoi } from "@/lib/campus/store.ts";
import { CATEGORY_LABEL } from "@/lib/campus/search.ts";
import { findRouteToPoi, formatDistance, REASON_LABEL } from "@/lib/routing/index.ts";
import { formatDuration, profileFromPrefs } from "@/lib/settings/prefs.ts";
import { usePrefs } from "@/lib/settings/usePrefs.ts";
import { ArGuidance } from "@/components/ArGuidance.tsx";

function PlaceScreen() {
  const params = useSearchParams();
  // Re-mount when the URL changes (e.g. the swap button) so "From" resets correctly.
  return <PlaceBody key={params.toString()} id={params.get("id")} fromParam={params.get("from")} />;
}

function PlaceBody({ id, fromParam }: { id: string | null; fromParam: string | null }) {
  const pack = getCampusPack();
  const poi = getPoi(id);
  const [prefs, setPrefs] = usePrefs();

  const startOptions = useMemo(
    () => pack.pois.filter((p) => p.id !== poi?.id).sort((a, b) => a.name.localeCompare(b.name)),
    [pack, poi],
  );
  const initialFrom = getPoi(fromParam)?.id ?? (poi?.id === DEFAULT_START_POI_ID ? startOptions[0]?.id : DEFAULT_START_POI_ID);
  const [fromId, setFromId] = useState(initialFrom);
  const from = getPoi(fromId);

  const route = useMemo(
    () => (poi && from ? findRouteToPoi(pack, from.nodeId, poi.id, profileFromPrefs(prefs)) : null),
    [pack, poi, from, prefs],
  );

  if (!poi) {
    return (
      <>
        <PageHeader title="Place not found" back="/places/" />
        <div className="space-y-3 px-4 pt-4">
          <p>This place is not in the campus data on this phone.</p>
          <Link href="/places/" className="inline-flex min-h-11 items-center font-semibold text-sign underline underline-offset-4">
            Search places
          </Link>
        </div>
      </>
    );
  }

  const nodeLevel = pack.nodes.find((n) => n.id === poi.nodeId)?.level ?? 0;

  return (
    <>
      <PageHeader title={poi.name} back="/places/">
        <p className="mt-1 flex items-center gap-2 text-sm text-white/85">
          <CategoryIcon category={poi.category} className="h-4 w-4" />
          {CATEGORY_LABEL[poi.category]}
          {nodeLevel !== 0 ? `, floor ${nodeLevel}` : ""}
        </p>
      </PageHeader>

      <div className="space-y-4 px-4 pt-4">
        {poi.description ? <p className="leading-relaxed">{poi.description}</p> : null}

        <section aria-labelledby="plan" className="space-y-3 rounded-xl border border-line bg-card p-4">
          <h2 id="plan" className="text-lg font-bold">Directions</h2>

          <div>
            <label htmlFor="from" className="text-sm font-semibold text-muted">From</label>
            <div className="mt-1 flex items-center gap-2">
              <select
                id="from"
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
                className="min-h-12 w-full rounded-lg border border-line bg-paper px-3 text-base"
              >
                {startOptions.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <Link
                href={`/place/?id=${fromId}&from=${poi.id}`}
                aria-label={`Reverse: directions from ${poi.name}`}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-line text-muted"
              >
                <SwapIcon className="h-5 w-5" />
              </Link>
            </div>
          </div>

          <label className="flex min-h-12 cursor-pointer items-center gap-3">
            <AccessIcon className={`h-6 w-6 ${prefs.stepFree ? "text-access" : "text-muted"}`} />
            <span className="flex-1 font-semibold">Step-free route</span>
            <input
              type="checkbox"
              role="switch"
              checked={prefs.stepFree}
              onChange={(e) => setPrefs({ stepFree: e.target.checked })}
              className="h-6 w-11 cursor-pointer appearance-none rounded-full bg-line transition-colors before:block before:h-5 before:w-5 before:translate-x-0.5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:bg-access checked:before:translate-x-[1.375rem]"
            />
          </label>
        </section>

        {route && route.ok ? (
          <>
            <section aria-label="Route summary" className="flex items-end justify-between rounded-xl bg-sign px-4 py-3 text-white">
              <div>
                <p className="text-3xl font-extrabold tabular-nums leading-none">{formatDuration(route.durationS)}</p>
                <p className="mt-1 text-sm text-white/80">{formatDistance(route.distanceM)} walk</p>
              </div>
              <p className={`rounded-full px-3 py-1 text-sm font-semibold ${route.hasStepsOrUnknown ? "bg-white/15" : "bg-access"}`}>
                {route.hasStepsOrUnknown ? "Includes steps" : "No steps"}
              </p>
            </section>

            <DataNotice status={route.dataStatus} compact />

            <figure className="overflow-hidden rounded-xl border border-line bg-card">
              <CampusMap pack={pack} route={route} label={`Map of the route from ${from?.name} to ${poi.name}`} />
              <figcaption className="border-t border-line px-3 py-2"><MapLegend showRoute /></figcaption>
            </figure>

            <section aria-labelledby="steps">
              <h2 id="steps" className="mb-2 text-lg font-bold">Steps</h2>
              <ol className="overflow-hidden rounded-xl border border-line bg-card">
                {route.instructions.map((ins, i) => (
                  <li key={i} className="flex gap-3 border-b border-line px-4 py-3 last:border-b-0">
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      ins.type === "arrive" ? "bg-sign text-white" : ins.type === "lift" ? "bg-access text-white" : "bg-route text-route-ink"
                    }`}>
                      {i + 1}
                    </span>
                    <span className="leading-snug">{ins.text}</span>
                  </li>
                ))}
              </ol>
            </section>

            <Link
              href={`/map/?from=${fromId}&to=${poi.id}`}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-sign font-semibold text-sign"
            >
              <MapIcon className="h-5 w-5" />
              Open on full map
            </Link>
          </>
        ) : route ? (
          <section role="alert" className="space-y-2 rounded-xl bg-danger-soft px-4 py-4 text-danger">
            <h2 className="font-bold">No route found</h2>
            <p className="leading-relaxed">
              {route.reason === "unreachable" && route.blockers.length > 0
                ? `The shortest mapped route has ${route.blockers.map((b) => REASON_LABEL[b.reason]).join(", ")}.`
                : route.message}
            </p>
            <p className="text-sm leading-relaxed">
              {route.blockers.some((b) => b.reason === "restricted")
                ? "This place is open to authorised people only."
                : prefs.stepFree
                  ? "Turning off step-free will show a route with steps. This app never guesses that an unsurveyed path is step-free."
                  : "Try starting from another place."}
            </p>
          </section>
        ) : null}

        <ArGuidance pack={pack} poi={poi} prefs={prefs} />

        <p className="flex items-center gap-2 pb-2 text-sm text-muted">
          Data status <StatusPill status={poi.provenance.status} />
        </p>
      </div>
    </>
  );
}

export default function PlacePage() {
  return (
    <Suspense fallback={<PageHeader title="Loading…" back="/places/" />}>
      <PlaceScreen />
    </Suspense>
  );
}
