"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader.tsx";
import {
  ArError,
  checkArAvailability,
  describeAvailability,
  openArTest,
  requestArInstall,
  type ArTestResult,
  type AvailabilityResult,
} from "@/lib/native/ar.ts";

type Phase = "checking" | "ready" | "running" | "error";

export default function ArCheckPage() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [availability, setAvailability] = useState<AvailabilityResult | null>(null);
  const [result, setResult] = useState<ArTestResult | null>(null);
  const [error, setError] = useState<ArError | null>(null);
  const [note, setNote] = useState("");

  const check = useCallback(async () => {
    setPhase("checking");
    setError(null);
    try {
      setAvailability(await checkArAvailability());
      setPhase("ready");
    } catch (e) {
      setError(e instanceof ArError ? e : new ArError("UNKNOWN", String(e)));
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const install = async () => {
    setError(null);
    try {
      const s = await requestArInstall();
      setNote(s === "INSTALLED" ? "Installed." : "Finish the install in Google Play, then come back and tap Check again.");
      if (s === "INSTALLED") await check();
    } catch (e) {
      setError(e instanceof ArError ? e : new ArError("UNKNOWN", String(e)));
    }
  };

  const runTest = async () => {
    setPhase("running");
    setError(null);
    setResult(null);
    try {
      setResult(await openArTest());
      setPhase("ready");
    } catch (e) {
      setError(e instanceof ArError ? e : new ArError("UNKNOWN", String(e)));
      setPhase("ready");
    }
  };

  const info = availability ? describeAvailability(availability.status) : null;
  const needsInstall = availability?.status === "SUPPORTED_NOT_INSTALLED" || availability?.status === "SUPPORTED_APK_TOO_OLD";

  return (
    <>
      <PageHeader title="AR on this phone" back="/settings/" />
      <div className="space-y-4 px-4 pt-4">
        <section aria-live="polite" className="rounded-xl border border-line bg-card p-4">
          {phase === "checking" ? (
            <p className="font-semibold">Checking AR support…</p>
          ) : info ? (
            <>
              <p className={`text-lg font-bold ${info.ok ? "text-sign" : "text-ink"}`}>{info.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{info.detail}</p>
              {availability?.status !== "NOT_ANDROID" ? (
                <p className="mt-2 text-xs text-muted">ARCore status: {availability?.status}</p>
              ) : null}
            </>
          ) : null}
          {note ? <p className="mt-2 text-sm text-sign">{note}</p> : null}
        </section>

        {needsInstall ? (
          <button type="button" onClick={install} className="min-h-12 w-full rounded-xl bg-sign font-semibold text-white">
            Install Google Play Services for AR
          </button>
        ) : null}

        {availability?.installed ? (
          <section aria-labelledby="test-h" className="space-y-3">
            <h2 id="test-h" className="text-lg font-bold">Camera test</h2>
            <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed">
              <li>Point the camera at the floor and move the phone slowly.</li>
              <li>When the floor is found, tap it to place an arrow.</li>
              <li>Walk around the arrow. It should stay fixed in the same spot on the floor.</li>
              <li>Tap Close to come back here.</li>
            </ol>
            <button
              type="button"
              onClick={runTest}
              disabled={phase === "running"}
              className="min-h-12 w-full rounded-xl bg-sign font-semibold text-white disabled:opacity-60"
            >
              {phase === "running" ? "AR camera open…" : "Open AR camera test"}
            </button>
            <p className="text-xs text-muted">Uses the camera only while the test screen is open. Nothing is recorded or sent.</p>
          </section>
        ) : null}

        {result ? (
          <section aria-labelledby="result-h" className="rounded-xl border border-line bg-card p-4">
            <h2 id="result-h" className="font-bold">Last test</h2>
            <dl className="mt-2 grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-muted">Arrow placed</dt><dd className="font-semibold">{result.arrowPlaced ? "Yes" : "No"}</dd>
              <dt className="text-muted">Floor areas found</dt><dd className="font-semibold">{result.maxPlanes}</dd>
              <dt className="text-muted">Tracking lost</dt><dd className="font-semibold">{result.trackingLossCount === 1 ? "Once" : `${result.trackingLossCount} times`}</dd>
              <dt className="text-muted">Time tracking</dt><dd className="font-semibold">{result.secondsTracking.toFixed(0)} s</dd>
            </dl>
          </section>
        ) : null}

        {error ? (
          <section role="alert" className="rounded-xl bg-danger-soft p-4 text-danger">
            <p className="font-bold">AR could not start</p>
            <p className="mt-1 text-sm leading-relaxed">{error.message}</p>
            <p className="mt-1 text-xs">Code: {error.code}</p>
          </section>
        ) : null}

        <button type="button" onClick={() => void check()} className="min-h-12 w-full rounded-xl border-2 border-line bg-card font-semibold">
          Check again
        </button>
      </div>
    </>
  );
}
