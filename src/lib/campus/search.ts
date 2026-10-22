/**
 * Offline place search over the campus pack's points of interest.
 * Pure function: no network, no storage — easy to test and fast on-device.
 */

import type { CampusPack, Poi, PoiCategory } from "./types.ts";

export const CATEGORY_LABEL: Record<PoiCategory, string> = {
  academic: "Academic buildings",
  library: "Library",
  laboratory: "Laboratories",
  administration: "Offices",
  hostel: "Hostels",
  food: "Food",
  medical: "Medical",
  sports: "Sports",
  "student-services": "Student services",
  entrance: "Gates and entrances",
};

/** Lowercase, strip accents and punctuation, collapse spaces. */
export function normalize(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Words that appear in every demo name and should not drive matching. */
const IGNORED = new Set(["demo", "the"]);

function score(poi: Poi, q: string): number {
  const name = normalize(poi.name);
  const names = [name, ...(poi.aliases ?? []).map(normalize)];
  const qWords = q.split(" ").filter((w) => w && !IGNORED.has(w));
  if (qWords.length === 0) return 0;

  let best = 0;
  for (const candidate of names) {
    const words = candidate.split(" ").filter((w) => !IGNORED.has(w));
    const stripped = words.join(" ");
    const query = qWords.join(" ");
    if (stripped === query) best = Math.max(best, 100);
    else if (stripped.startsWith(query)) best = Math.max(best, 80);
    else if (qWords.every((qw) => words.some((w) => w.startsWith(qw)))) best = Math.max(best, 60);
    else if (stripped.includes(query)) best = Math.max(best, 40);
  }
  // A name match is worth slightly more than an alias match with the same score.
  if (best > 0 && normalize(poi.name).includes(qWords[0])) best += 5;
  return best;
}

export interface SearchOptions {
  category?: PoiCategory;
  limit?: number;
}

/** Search POIs by name and aliases. An empty query lists all (filtered by category), A→Z. */
export function searchPois(pack: CampusPack, query: string, opts: SearchOptions = {}): Poi[] {
  const pool = opts.category ? pack.pois.filter((p) => p.category === opts.category) : pack.pois;
  const q = normalize(query);
  let results: Poi[];
  if (!q) {
    results = [...pool].sort((a, b) => a.name.localeCompare(b.name));
  } else {
    results = pool
      .map((p) => ({ p, s: score(p, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name))
      .map((x) => x.p);
  }
  return opts.limit ? results.slice(0, opts.limit) : results;
}

/** Categories that actually have places in this pack, in a stable display order. */
export function categoriesIn(pack: CampusPack): PoiCategory[] {
  const present = new Set(pack.pois.map((p) => p.category));
  return (Object.keys(CATEGORY_LABEL) as PoiCategory[]).filter((c) => present.has(c));
}
