"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { CategoryIcon, ChevronIcon, SearchIcon } from "@/components/icons.tsx";
import { PageHeader } from "@/components/PageHeader.tsx";
import { StatusPill } from "@/components/DataNotice.tsx";
import { getCampusPack } from "@/lib/campus/store.ts";
import { CATEGORY_LABEL, categoriesIn, searchPois } from "@/lib/campus/search.ts";
import type { PoiCategory } from "@/lib/campus/types.ts";

function PlacesScreen() {
  const params = useSearchParams();
  const pack = getCampusPack();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState<PoiCategory | undefined>(undefined);
  const categories = useMemo(() => categoriesIn(pack), [pack]);
  const results = useMemo(() => searchPois(pack, query, { category }), [pack, query, category]);

  return (
    <>
      <PageHeader title="Places">
        <label htmlFor="places-search" className="sr-only">Search places</label>
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-white px-3 text-ink">
          <SearchIcon className="h-5 w-5 shrink-0 text-muted" />
          <input
            id="places-search"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name"
            className="min-h-12 w-full bg-transparent text-base outline-none placeholder:text-muted"
          />
        </div>
      </PageHeader>

      <div className="px-4">
        <div role="group" aria-label="Filter by type" className="-mx-4 flex gap-2 overflow-x-auto px-4 py-3">
          {[undefined, ...categories].map((c) => {
            const active = c === category;
            return (
              <button
                key={c ?? "all"}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(c)}
                className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold ${
                  active ? "border-sign bg-sign text-white" : "border-line bg-card text-ink"
                }`}
              >
                {c ? CATEGORY_LABEL[c] : "All"}
              </button>
            );
          })}
        </div>

        <p className="sr-only" aria-live="polite">{results.length} places found</p>

        {results.length === 0 ? (
          <div className="rounded-xl border border-line bg-card px-4 py-6 text-center">
            <p className="font-semibold">No places match “{query.trim()}”</p>
            <p className="mt-1 text-sm text-muted">Try a shorter word, or clear the type filter.</p>
            <button
              type="button"
              onClick={() => { setQuery(""); setCategory(undefined); }}
              className="mt-3 min-h-11 rounded-lg px-4 font-semibold text-sign underline underline-offset-4"
            >
              Show all places
            </button>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-line bg-card">
            {results.map((poi) => (
              <li key={poi.id} className="border-b border-line last:border-b-0">
                <Link href={`/place/?id=${poi.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sign/10 text-sign">
                    <CategoryIcon category={poi.category} className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug">{poi.name}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-sm text-muted">
                      {CATEGORY_LABEL[poi.category]}
                      <StatusPill status={poi.provenance.status} />
                    </span>
                  </span>
                  <ChevronIcon className="h-5 w-5 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export default function PlacesPage() {
  // useSearchParams needs a Suspense boundary in a statically exported app.
  return (
    <Suspense fallback={<PageHeader title="Places" />}>
      <PlacesScreen />
    </Suspense>
  );
}
