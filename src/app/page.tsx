"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { AccessIcon, CategoryIcon, ChevronIcon, SearchIcon } from "@/components/icons.tsx";
import { DataNotice } from "@/components/DataNotice.tsx";
import { DEFAULT_START_POI_ID, useCampusPack, getPoi } from "@/lib/campus/store.ts";
import { findRouteToPoi, formatDistance } from "@/lib/routing/index.ts";
import { formatDuration, profileFromPrefs } from "@/lib/settings/prefs.ts";
import { usePrefs } from "@/lib/settings/usePrefs.ts";

const shortName = (name: string) => name.replace(/^Demo /, "");

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [prefs] = usePrefs();
  const pack = useCampusPack();
  const start = getPoi(DEFAULT_START_POI_ID) ?? pack.pois.find((p) => p.category === "entrance") ?? pack.pois[0];

  const rows = useMemo(() => {
    if (!start) return [];
    const profile = profileFromPrefs(prefs);
    return pack.pois
      .filter((p) => p.id !== start.id)
      .map((poi) => ({ poi, route: findRouteToPoi(pack, start.nodeId, poi.id, profile) }))
      .sort((a, b) => {
        const da = a.route.ok ? a.route.distanceM : Infinity;
        const db = b.route.ok ? b.route.distanceM : Infinity;
        return da - db || a.poi.name.localeCompare(b.poi.name);
      });
  }, [pack, prefs, start]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/places/?q=${encodeURIComponent(q)}` : "/places/");
  };

  return (
    <div className="space-y-5 px-4 pt-4">
      <Link
        href="/landmarks/"
        className="block rounded-3xl bg-gradient-to-br from-[#3b4fd8] to-[#7b3fe4] p-5 text-white shadow-lg"
      >
        <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">VIT Vellore</span>
        <span className="mt-3 block text-2xl font-extrabold leading-tight">Explore the campus</span>
        <span className="mt-1 block text-sm text-white/85">SJT, TT, MGR, PRP, library and hostels: guidance from where you stand.</span>
        <span className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-white font-semibold text-[#2a2f8f]">Open campus landmarks</span>
      </Link>
      <section aria-labelledby="where-to" className="rounded-2xl bg-sign p-2 text-white shadow-sm">
        <div className="rounded-xl border-2 border-white/90 px-4 pb-3 pt-4">
          <p className="text-sm font-semibold text-white/80">VIT ImmersiveAR</p>
          <h1 id="where-to" className="mt-1 text-[2.5rem] font-extrabold leading-none tracking-tight">
            Where to?
          </h1>

          <form onSubmit={submit} role="search" className="mt-4">
            <label htmlFor="home-search" className="sr-only">Search places</label>
            <div className="flex items-center gap-2 rounded-xl bg-white px-3 text-ink">
              <SearchIcon className="h-5 w-5 shrink-0 text-muted" />
              <input
                id="home-search"
                type="search"
                enterKeyHint="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Library, lab, canteen..."
                className="min-h-12 w-full bg-transparent text-base outline-none placeholder:text-muted"
              />
            </div>
          </form>

          <p className="mt-5 text-xs font-semibold text-white/75">
            Walking from {start ? shortName(start.name) : "-"}
            {prefs.stepFree ? ", step-free" : ""}
          </p>
          <ul className="mt-1 divide-y divide-white/20">
            {rows.map(({ poi, route }) => (
              <li key={poi.id}>
                <Link href={`/place/?id=${poi.id}`} className="flex min-h-14 items-center gap-3 py-2">
                  <CategoryIcon category={poi.category} className="h-6 w-6 shrink-0 text-white/90" />
                  <span className="flex-1 text-lg font-bold leading-tight">{shortName(poi.name).replace(/\s*\(.*\)$/, "")}</span>
                  {route.ok ? (
                    <span className="text-right tabular-nums">
                      <span className="block text-lg font-bold leading-tight">{formatDistance(route.distanceM)}</span>
                      <span className="block text-xs text-white/75">{formatDuration(route.durationS)}</span>
                    </span>
                  ) : (
                    <span className="text-right text-sm text-white/75">
                      {route.blockers.some((b) => b.reason === "restricted") ? "Residents only" : "No route"}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <DataNotice status={pack.isDemo ? "demo" : "verified"} />

      <Link
        href="/settings/"
        className="flex min-h-16 items-center gap-3 rounded-xl border border-line bg-card px-4 py-3"
      >
        <span className={`flex h-10 w-10 items-center justify-center rounded-full ${prefs.stepFree ? "bg-access text-white" : "bg-access-soft text-access"}`}>
          <AccessIcon className="h-6 w-6" />
        </span>
        <span className="flex-1">
          <span className="block font-semibold">Step-free routes {prefs.stepFree ? "on" : "off"}</span>
          <span className="block text-sm text-muted">
            {prefs.stepFree ? "Routes avoid steps and unsurveyed paths" : "Turn on to avoid steps and steep ramps"}
          </span>
        </span>
        <ChevronIcon className="h-5 w-5 text-muted" />
      </Link>
    </div>
  );
}