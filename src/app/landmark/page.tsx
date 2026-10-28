"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useRef, useState, type ChangeEvent } from "react";
import { arrivalRadiusM, bearingDeg, compassWord, distanceM, formatMetres, relativeBearing, unwrapRotation } from "@/lib/landmarks/geo.ts";
import { clearLandmark, KIND_LABEL, resizePhoto, saveLocation, savePhoto, useLandmarks } from "@/lib/landmarks/store.ts";
import { useCompass } from "@/lib/landmarks/useCompass.ts";
import { getOnePosition, useLocation } from "@/lib/location/useLocation.ts";

function LandmarkScreen() {
  const params = useSearchParams();
  return <LandmarkBody key={params.toString()} id={params.get("id")} startGuide={params.get("go") === "1"} />;
}

function LandmarkBody({ id, startGuide }: { id: string | null; startGuide: boolean }) {
  const list = useLandmarks();
  const l = list.find((x) => x.id === id);
  const [guiding, setGuiding] = useState(startGuide);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  if (!l) {
    return (
      <div className="min-h-dvh bg-[#0b1020] p-6 text-white">
        <p>Place not found.</p>
        <Link href="/landmarks/" className="mt-4 inline-block underline">Back to landmarks</Link>
      </div>
    );
  }

  const saveHere = async () => {
    setBusy(true);
    setNote("Getting your location… stand still at the entrance.");
    try {
      const fix = await getOnePosition();
      if (fix.accuracyM > 30) {
        setNote(`GPS is only accurate to about ${Math.round(fix.accuracyM)} m here. Move into the open and try again.`);
      } else {
        saveLocation(l.id, fix);
        setNote(`Saved. Accurate to about ${Math.round(fix.accuracyM)} m.`);
      }
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      savePhoto(l.id, await resizePhoto(f));
      setNote("Photo saved on this phone.");
    } catch (err) {
      setNote((err as Error).message);
    }
  };

  return (
    <div className="min-h-dvh bg-[#0b1020] pb-6 text-white">
      <div className="relative h-56 bg-gradient-to-br from-[#1d2a55] to-[#2b1d55]">
        {l.data?.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.data.photo} alt={`Photo of ${l.name}`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl font-extrabold text-white/40">{l.short}</div>
        )}
        <Link href="/landmarks/" aria-label="Back" className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-2xl">
          ‹
        </Link>
      </div>

      <div className="px-4 pt-4">
        <p className="text-sm font-semibold text-[#8fa8ff]">{KIND_LABEL[l.kind]}</p>
        <h1 className="text-2xl font-extrabold">{l.name}</h1>

        {guiding && l.data ? (
          <Guide target={l.data} name={l.name} minArriveM={l.dataSource === "builtin" ? 35 : 0} onStop={() => setGuiding(false)} />
        ) : (
          <>
            {l.data ? (
              <p className="mt-2 text-sm text-white/70">
                {l.dataSource === "builtin" && l.seed
                  ? `Position from ${l.seed.source}. If you are at the entrance, tap “Update location” for a more exact point.`
                  : `Location saved ${new Date(l.data.savedAt).toLocaleDateString()} with this phone's GPS (about ±${Math.round(l.data.accuracyM)} m).`}
              </p>
            ) : (
              <p className="mt-2 rounded-xl bg-amber-500/15 p-3 text-sm text-amber-200">
                Not located yet. Go to this place&apos;s main entrance, stand outside in the open, and tap “I&apos;m here — save location”.
              </p>
            )}

            <div className="mt-4 grid gap-2">
              {l.data ? (
                <button type="button" onClick={() => setGuiding(true)} className="min-h-14 rounded-xl bg-[#3b6cff] text-lg font-bold">
                  Guide me from here
                </button>
              ) : null}
              <button type="button" disabled={busy} onClick={saveHere} className="min-h-12 rounded-xl bg-white/10 font-semibold disabled:opacity-50">
                {l.data ? "Update location: I'm here now" : "I'm here — save location"}
              </button>
              <button
                type="button"
                disabled={!l.data}
                onClick={() => fileInput.current?.click()}
                className="min-h-12 rounded-xl bg-white/10 font-semibold disabled:opacity-40"
              >
                {l.data?.photo ? "Change photo" : "Take a photo of this place"}
              </button>
              <input ref={fileInput} type="file" accept="image/*" capture="environment" onChange={onPhoto} className="sr-only" aria-hidden tabIndex={-1} />
              {l.data ? (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${l.data.lat},${l.data.lng}&travelmode=walking`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-12 items-center justify-center rounded-xl bg-white/10 font-semibold"
                >
                  Open walking directions in Google Maps
                </a>
              ) : null}
              {l.dataSource === "phone" || l.data?.photo || l.custom ? (
                <button
                  type="button"
                  onClick={() => {
                    clearLandmark(l.id);
                    setNote(l.custom ? "Removed." : "Your saved location and photo were deleted.");
                  }}
                  className="min-h-12 rounded-xl text-sm font-semibold text-red-300"
                >
                  {l.custom ? "Remove this place" : "Delete my saved location and photo"}
                </button>
              ) : null}
            </div>
            {note ? <p className="mt-3 text-sm text-white/85" role="status">{note}</p> : null}
            {l.id === "prp" ? (
              <Link href="/places/" className="mt-4 block rounded-xl bg-emerald-600/20 p-3 text-sm text-emerald-200">
                Inside PRP: import the PRP map (Settings → Offline campus data), then use Places → G31–G34 → Guide me with AR.
              </Link>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/** Outdoor guidance: GPS position + phone compass → an arrow pointing at the place. */
function Guide({ target, name, minArriveM, onStop }: { target: { lat: number; lng: number }; name: string; minArriveM: number; onStop: () => void }) {
  const loc = useLocation(true);
  const heading = useCompass(true);
  const rotation = useRef(0);

  const fix = loc.fix;
  const dist = fix ? distanceM(fix, target) : null;
  const bearing = fix ? bearingDeg(fix, target) : null;
  const arrived = fix && dist !== null ? dist <= Math.max(minArriveM, arrivalRadiusM(fix.accuracyM)) : false;
  // No compass → use GPS travel direction when walking; otherwise only words.
  const facing = heading ?? (fix?.headingDeg != null && Number.isFinite(fix.headingDeg) ? fix.headingDeg : null);
  if (bearing !== null && facing !== null) rotation.current = unwrapRotation(rotation.current, relativeBearing(bearing, facing));
  const turn = bearing !== null && facing !== null ? relativeBearing(bearing, facing) : null;

  return (
    <section className="mt-4 rounded-3xl bg-[#131a2e] p-5 text-center" aria-live="polite">
      {!fix ? (
        <p className="py-10 text-white/80">{loc.message || "Finding your location… go outside if you are indoors."}</p>
      ) : arrived ? (
        <div className="py-8">
          <p className="text-5xl">✓</p>
          <p className="mt-3 text-2xl font-bold">You have arrived</p>
          <p className="mt-1 text-white/70">{name} is within about {Math.round(dist ?? 0)} m.</p>
        </div>
      ) : (
        <>
          <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-full border-4 border-white/10">
            {facing !== null ? (
              <svg
                viewBox="0 0 100 100"
                className="h-40 w-40 transition-transform duration-300"
                style={{ transform: `rotate(${rotation.current}deg)` }}
                aria-hidden
              >
                <path d="M50 6 L82 70 L50 56 L18 70 Z" fill="#f5b301" stroke="#5c4300" strokeWidth="3" strokeLinejoin="round" />
              </svg>
            ) : (
              <p className="px-6 text-white/80">Compass not available. Head towards the {compassWord(bearing ?? 0)}.</p>
            )}
          </div>
          <p className="mt-4 text-4xl font-extrabold tabular-nums">{formatMetres(dist ?? 0)}</p>
          <p className="mt-1 text-white/80">
            {turn === null ? `towards the ${compassWord(bearing ?? 0)}` : Math.abs(turn) < 20 ? "Straight ahead" : turn > 0 ? "Turn right" : "Turn left"}
          </p>
          <p className="mt-3 text-xs text-white/55">
            GPS accuracy about {Math.round(fix.accuracyM)} m. Hold the phone flat, away from metal. The arrow points in a straight line, not
            along paths; follow the footpaths.
          </p>
        </>
      )}
      <button type="button" onClick={onStop} className="mt-5 min-h-12 w-full rounded-xl bg-white/10 font-semibold">
        End guidance
      </button>
    </section>
  );
}

export default function LandmarkPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#0b1020]" />}>
      <LandmarkScreen />
    </Suspense>
  );
}
