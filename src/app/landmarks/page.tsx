"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { bearingDeg, compassWord, distanceM, formatMetres } from "@/lib/landmarks/geo.ts";
import { addCustom, KIND_LABEL, useLandmarks, type Landmark } from "@/lib/landmarks/store.ts";
import { useLocation } from "@/lib/location/useLocation.ts";

export default function LandmarksPage() {
  const list = useLandmarks();
  const [useGps, setUseGps] = useState(false);
  const loc = useLocation(useGps);
  const [filter, setFilter] = useState<"all" | "academic" | "hostel" | "other">("all");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");

  const rows = useMemo(() => {
    const here = loc.fix;
    return list
      .filter((l) => filter === "all" || (filter === "other" ? !["academic", "hostel"].includes(l.kind) : l.kind === filter))
      .map((l) => ({
        l,
        dist: here && l.data ? distanceM(here, l.data) : null,
        bearing: here && l.data ? bearingDeg(here, l.data) : null,
      }))
      .sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity) || Number(!!b.l.data) - Number(!!a.l.data));
  }, [list, loc.fix, filter]);

  const located = list.filter((l) => l.data).length;

  return (
    <div className="min-h-dvh bg-[#0b1020] px-4 pb-6 pt-4 text-white">
      <section className="rounded-3xl bg-gradient-to-br from-[#3b4fd8] to-[#7b3fe4] p-5 shadow-lg">
        <p className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">VIT Vellore campus</p>
        <h1 className="mt-3 text-3xl font-extrabold leading-tight">Campus landmarks</h1>
        <p className="mt-2 text-sm text-white/85">
          Find blocks and hostels from where you are standing. Locations and photos are recorded on site with this phone.
        </p>
        <button
          type="button"
          onClick={() => setUseGps((v) => !v)}
          className="mt-4 min-h-12 w-full rounded-xl bg-white font-semibold text-[#2a2f8f]"
        >
          {useGps ? "Stop using my location" : "Show distances from me"}
        </button>
        {useGps ? (
          <p className="mt-2 text-xs text-white/85" role="status">
            {loc.fix ? `Location found, accurate to about ${Math.round(loc.fix.accuracyM)} m` : loc.message || "Finding your location…"}
          </p>
        ) : null}
      </section>

      <p className="mt-4 text-sm text-white/70">
        {located} of {list.length} places located.{" "}
        {located < list.length ? "Open a place and tap “I'm here — save location” while standing at its entrance." : ""}
      </p>

      <div className="mt-3 flex gap-2 overflow-x-auto" role="tablist" aria-label="Filter">
        {(["all", "academic", "hostel", "other"] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${filter === f ? "bg-[#3b6cff] text-white" : "bg-white/10 text-white/80"}`}
          >
            {f === "all" ? "All" : f === "academic" ? "Academic" : f === "hostel" ? "Hostels" : "Other"}
          </button>
        ))}
      </div>

      <ul className="mt-4 space-y-4">
        {rows.map(({ l, dist, bearing }) => (
          <li key={l.id}>
            <LandmarkCard l={l} dist={dist} bearing={bearing} />
          </li>
        ))}
      </ul>

      <p className="mt-6 text-xs text-white/50">
        Building positions: © OpenStreetMap contributors (ODbL), building centres. PRP E2 entrance: student GPS survey.
        Photos are your own, taken in the app.
      </p>

      <form
        className="mt-4 rounded-2xl bg-white/5 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            addCustom(newName);
            setNewName("");
            setError("");
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <label htmlFor="new-place" className="font-semibold">Add another place</label>
        <div className="mt-2 flex gap-2">
          <input
            id="new-place"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Food court, Anna Auditorium"
            className="min-h-12 flex-1 rounded-xl bg-white/10 px-3 text-white placeholder:text-white/40"
          />
          <button type="submit" className="min-h-12 rounded-xl bg-[#3b6cff] px-4 font-semibold">Add</button>
        </div>
        {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
      </form>
    </div>
  );
}

function LandmarkCard({ l, dist, bearing }: { l: Landmark; dist: number | null; bearing: number | null }) {
  return (
    <article className="overflow-hidden rounded-2xl bg-[#131a2e] shadow">
      <div className="relative h-40 bg-gradient-to-br from-[#1d2a55] to-[#2b1d55]">
        {l.data?.photo || l.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.data?.photo ?? l.image} alt={`Photo of ${l.name}`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-white/50">
            <span className="text-4xl font-extrabold">{l.short}</span>
            <span className="mt-1 text-xs">No photo yet</span>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold">{KIND_LABEL[l.kind]}</span>
        <span className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-semibold ${l.data ? "bg-emerald-500/90" : "bg-amber-500/90 text-black"}`}>
          {l.data ? "Located" : "Location not set"}
        </span>
      </div>
      <div className="p-4">
        <h2 className="text-xl font-bold">{l.name}</h2>
        <p className="mt-1 text-sm text-white/70">
          {dist !== null && bearing !== null
            ? `${formatMetres(dist)} away, towards the ${compassWord(bearing)}`
            : l.data
              ? "Tap “Show distances from me” to see how far."
              : "Not located yet."}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link href={`/landmark/?id=${l.id}`} className="flex min-h-12 items-center justify-center rounded-xl bg-white/10 font-semibold">
            Details
          </Link>
          <Link
            href={`/landmark/?id=${l.id}&go=1`}
            aria-disabled={!l.data}
            className={`flex min-h-12 items-center justify-center rounded-xl font-semibold ${l.data ? "bg-[#3b6cff]" : "pointer-events-none bg-white/5 text-white/40"}`}
          >
            Guide me
          </Link>
        </div>
      </div>
    </article>
  );
}
