"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { CampusMap, MapLegend } from "@/components/CampusMap.tsx";
import { DataNotice } from "@/components/DataNotice.tsx";
import { CategoryIcon } from "@/components/icons.tsx";
import { PageHeader } from "@/components/PageHeader.tsx";
import { getCampusPack, getPoi } from "@/lib/campus/store.ts";
import { CATEGORY_LABEL } from "@/lib/campus/search.ts";
import { findRouteToPoi, formatDistance } from "@/lib/routing/index.ts";
import { formatDuration, profileFromPrefs } from "@/lib/settings/prefs.ts";
import { usePrefs } from "@/lib/settings/usePrefs.ts";

function MapScreen() {
  const params = useSearchParams();
  const pack = getCampusPack();
  const [prefs] = usePrefs();
  const from = getPoi(params.get("from"));
  const to = getPoi(params.get("to"));
  const [selectedId, setSelectedId] = useState<string | null>(to?.id ?? null);
  const selected = getPoi(selectedId);

  const route = useMemo(() => {
    if (!from || !to) return null;
    const r = findRouteToPoi(pack, from.nodeId, to.id, profileFromPrefs(prefs));
    return r.ok ? r : null;
  }, [pack, from, to, prefs]);

  return (
    <>
      <PageHeader title="Campus map" back={to ? `/place/?id=${to.id}${from ? `&from=${from.id}` : ""}` : undefined}>
        {route && from && to ? (
          <p className="mt-1 text-sm text-white/85">
            {from.name.replace(/^Demo /, "")} to {to.name.replace(/^Demo /, "")}: {formatDistance(route.distanceM)}, {formatDuration(route.durationS)}
          </p>
        ) : (
          <p className="mt-1 text-sm text-white/85">Tap a place to see it</p>
        )}
      </PageHeader>

      <div className="space-y-3 px-4 pt-4">
        <figure className="overflow-hidden rounded-xl border border-line bg-card">
          <CampusMap
            pack={pack}
            route={route}
            selectedPoiId={selectedId}
            onSelectPoi={setSelectedId}
            label={route && from && to ? `Campus map with the route from ${from.name} to ${to.name}` : "Campus map. Places are buttons."}
          />
          <figcaption className="border-t border-line px-3 py-2"><MapLegend showRoute={!!route} /></figcaption>
        </figure>

        {selected ? (
          <section aria-live="polite" className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sign/10 text-sign">
              <CategoryIcon category={selected.category} className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold leading-snug">{selected.name}</span>
              <span className="block text-sm text-muted">{CATEGORY_LABEL[selected.category]}</span>
            </span>
            <Link
              href={`/place/?id=${selected.id}`}
              className="flex min-h-11 items-center rounded-lg bg-sign px-4 font-semibold text-white"
            >
              Directions
            </Link>
          </section>
        ) : null}

        <DataNotice status={pack.isDemo ? "demo" : "verified"} compact />
        <p className="text-xs leading-relaxed text-muted">
          Ground-level paths only. Numbers on markers are floors. Your live position is not shown yet.
        </p>
      </div>
    </>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<PageHeader title="Campus map" />}>
      <MapScreen />
    </Suspense>
  );
}
