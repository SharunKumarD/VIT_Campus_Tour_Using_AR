"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { StatusPill } from "@/components/DataNotice.tsx";
import { PageHeader } from "@/components/PageHeader.tsx";
import { importPack, resetToBundled, useCampusState } from "@/lib/campus/store.ts";

const MAX_PACK_BYTES = 5 * 1024 * 1024;

export default function OfflinePage() {
  const campus = useCampusState();
  const pack = campus.pack;
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [copied, setCopied] = useState("");

  const counts = [
    ["Places", pack.pois.length],
    ["Path points", pack.nodes.length],
    ["Path segments", pack.edges.length],
    ["Buildings", pack.buildings.length],
    ["Markers", pack.checkpoints.length],
  ] as const;
  const verifiedEdges = pack.edges.filter((e) => e.provenance.status === "verified").length;
  const unknownSteps = pack.edges.filter((e) => e.steps === "unknown").length;

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErrors([]);
    setNote("");
    if (file.size > MAX_PACK_BYTES) {
      setErrors([`The file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Campus packs must be under 5 MB.`]);
      return;
    }
    setBusy(true);
    try {
      const result = await importPack(await file.text());
      if (result.ok) setNote(`Imported "${file.name}". All screens now use this map.`);
      else setErrors(result.errors);
    } finally {
      setBusy(false);
    }
  };

  const copyPack = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(pack, null, 2));
      setCopied("Campus data copied as JSON.");
    } catch {
      setCopied("Could not copy on this phone.");
    }
  };

  return (
    <>
      <PageHeader title="Offline campus data" back="/settings/" />
      <div className="space-y-5 px-4 pt-4">
        <section className="rounded-xl border border-line bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold leading-snug">{pack.name}</p>
              <p className="mt-0.5 text-sm text-muted">
                Version {pack.version}, published {new Date(pack.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
            <StatusPill status={pack.isDemo ? "demo" : "verified"} />
          </div>
          <p className="mt-2 text-sm">
            {campus.source === "imported"
              ? `Imported on this phone${campus.importedAt ? ` on ${new Date(campus.importedAt).toLocaleString("en-IN")}` : ""}.`
              : "Built into the app."}{" "}
            Search and routes work with no internet.
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
            {counts.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{k}</dt>
                <dd className="font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
            <dt className="text-muted">Verified segments</dt>
            <dd className="font-semibold tabular-nums">{verifiedEdges} of {pack.edges.length}</dd>
            <dt className="text-muted">Steps not surveyed</dt>
            <dd className="font-semibold tabular-nums">{unknownSteps}</dd>
          </dl>
        </section>

        <section aria-labelledby="import-h" className="space-y-2">
          <h2 id="import-h" className="text-lg font-bold">Import a campus map</h2>
          <p className="text-sm leading-relaxed text-muted">
            Choose a campus pack file (.json) from this phone. It is checked in full before use; a file with any problem is
            rejected and the current map is kept.
          </p>
          <input ref={fileInput} type="file" accept="application/json,.json" onChange={onFile} className="sr-only" id="pack-file" />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            className="min-h-12 w-full rounded-xl bg-sign font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Checking file…" : "Choose campus pack file"}
          </button>
          <p aria-live="polite" className="text-sm text-sign">{note}</p>
          {errors.length ? (
            <div role="alert" className="rounded-xl bg-danger-soft p-4 text-sm text-danger">
              <p className="font-bold">File not imported ({errors.length} problem{errors.length === 1 ? "" : "s"})</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {errors.slice(0, 8).map((e) => <li key={e}>{e}</li>)}
              </ul>
              {errors.length > 8 ? <p className="mt-1">…and {errors.length - 8} more.</p> : null}
            </div>
          ) : null}
        </section>

        <section className="space-y-2">
          <button type="button" onClick={copyPack} className="min-h-12 w-full rounded-xl border-2 border-line bg-card font-semibold">
            Copy current map as JSON
          </button>
          <p aria-live="polite" className="text-sm text-muted">{copied}</p>
          {campus.source === "imported" ? (
            <button
              type="button"
              onClick={async () => { await resetToBundled(); setNote("Back to the built-in demo map."); }}
              className="min-h-12 w-full rounded-xl border-2 border-line bg-card font-semibold"
            >
              Remove imported map
            </button>
          ) : null}
        </section>
      </div>
    </>
  );
}
