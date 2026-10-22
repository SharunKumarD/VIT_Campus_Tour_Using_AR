"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { CampusMap, MapLegend } from "@/components/CampusMap.tsx";
import { DataNotice } from "@/components/DataNotice.tsx";
import { CategoryIcon } from "@/components/icons.tsx";
import { PageHeader } from "@/components/PageHeader.tsx";
import { useCampusPack, getPoi } from "@/lib/campus/store.ts";
import { CATEGORY_LABEL } from "@/lib/campus/search.ts";
import { findRoute, findRouteToPoi, formatDistance } from "@/lib/routing/index.ts";
import { describeFix, locate } from "@/lib/location/position.ts";
import { useLocation } from "@/lib/location/useLocation.ts";
import { formatDuration, profileFromPrefs } from "@/lib/settings/prefs.ts";
import { usePrefs } from "@/lib/settings/usePrefs.ts";

function MapScreen() {
  const params = useSearchParams();
  const pack = useCampusPack();
  const [prefs] = usePrefs();
  const from = getPoi(params.get("from"));
  const to = getPoi(params.get("to"));
  const [selectedId, setSelectedId] = useState<string | null>(to?.id ?? null);
  const selected = getPoi(selectedId);
  const [showMe, setShowMe] = useState(params.get("here") === "1");
  const loc = useLocation(showMe);
  const located = useMemo(() => (loc.fix ? locate(pack, loc.fix) : null), [pack, loc.fix]);
  const hereNodeId = located?.canStartHere ? located.nearest!.node.id : null;

  const route = useMemo(() => {
    if (!to) return null;
    const profile = profileFromPrefs(prefs);
    const r = from
      ? findRouteToPoi(pack, from.nodeId, to.id, profile)
      : showMe && hereNodeId
        ? findRoute(pack, hereNodeId, to.nodeId, profile)
        : null;
    return r && r.ok ? r : null;
  }, [pack, from, to, prefs, showMe, hereNodeId]);
  const startName = from ? from.name.replace(/^Demo /, "") : "Your location";

  return (
    <>
      <PageHeader title="Campus map" back={to ? `/place/?id=${to.id}${from ? `&from=${from.id}` : ""}` : undefined}>
        {route && to ? (
          <p className="mt-1 text-sm text-white/85">
            {startName} to {to.name.replace(/^Demo /, "")}: {formatDistance(route.distanceM)}, {formatDuration(route.durationS)}
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
            user={showMe && located && loc.fix ? { ...located.campus, accuracyM: loc.fix.accuracyM } : null}
            label={route && to ? `Campus map with the route from ${startName} to ${to.name}` : "Campus map. Places are buttons."}
          />
          <figcaption className="border-t border-line px-3 py-2"><MapLegend showRoute={!!route} /></figcaption>
        </figure>

        <button
          type="button"
          aria-pressed={showMe}
          onClick={() => setShowMe((v) => !v)}
          className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 font-semibold ${
            showMe ? "border-access bg-access text-white" : "border-access bg-card text-access"
          }`}
        >
          <span aria-hidden className="inline-block h-3 w-3 rounded-full border-2 border-current" />
          {showMe ? "Hide my location" : "Show my location"}
        </button>
        {showMe ? (
          <p aria-live="polite" className="text-sm text-muted">
            {loc.status === "denied" || loc.status === "unavailable"
              ? loc.message
              : located && loc.fix
                ? describeFix(located, loc.fix.accuracyM) +
                  (!located.onCampus && pack.isDemo ? " To test the demo map here, use Settings > Location." : "")
                : "Finding your location…"}
          </p>
        ) : null}

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
          Ground-level paths only. Numbers on markers are floors. GPS is not used indoors or to tell floors apart.
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
