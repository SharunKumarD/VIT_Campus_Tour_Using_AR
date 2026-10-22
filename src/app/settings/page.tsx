"use client";

import { useState } from "react";
import { StatusPill } from "@/components/DataNotice.tsx";
import { PageHeader } from "@/components/PageHeader.tsx";
import { getCampusPack } from "@/lib/campus/store.ts";
import type { Prefs } from "@/lib/settings/prefs.ts";
import { usePrefs } from "@/lib/settings/usePrefs.ts";

const OPTIONS: { key: keyof Prefs; title: string; detail: string }[] = [
  {
    key: "stepFree",
    title: "Step-free routes",
    detail: "Avoids steps and ramps steeper than 1:12. Paths whose steps have not been surveyed are also avoided.",
  },
  { key: "avoidUnpaved", title: "Avoid unpaved paths", detail: "Prefers paved paths when the detour is small." },
  { key: "preferCovered", title: "Prefer covered walkways", detail: "Prefers shade and shelter when the detour is small." },
  { key: "slowerPace", title: "Slower walking pace", detail: "Walking times assume a more relaxed pace." },
];

export default function SettingsPage() {
  const [prefs, setPrefs, resetPrefs] = usePrefs();
  const [resetDone, setResetDone] = useState(false);
  const pack = getCampusPack();
  const published = new Date(pack.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-6 px-4 pt-4">
        <section aria-labelledby="routes-h">
          <h2 id="routes-h" className="mb-2 text-lg font-bold">Routes</h2>
          <ul className="overflow-hidden rounded-xl border border-line bg-card">
            {OPTIONS.map((o) => (
              <li key={o.key} className="border-b border-line last:border-b-0">
                <label className="flex cursor-pointer items-start gap-3 px-4 py-3">
                  <span className="flex-1">
                    <span className="block font-semibold">{o.title}</span>
                    <span className="mt-0.5 block text-sm leading-snug text-muted">{o.detail}</span>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={prefs[o.key]}
                    onChange={(e) => { setPrefs({ [o.key]: e.target.checked }); setResetDone(false); }}
                    className="mt-1 h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-line transition-colors before:block before:h-5 before:w-5 before:translate-x-0.5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:bg-access checked:before:translate-x-[1.375rem]"
                  />
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Step-free routes follow the map data. They are not a guarantee of wheelchair access until the data is verified on site.
          </p>
        </section>

        <section aria-labelledby="data-h">
          <h2 id="data-h" className="mb-2 text-lg font-bold">Campus data</h2>
          <dl className="overflow-hidden rounded-xl border border-line bg-card text-sm">
            {[
              ["Map", pack.name],
              ["Version", pack.version],
              ["Published", published],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-4 border-b border-line px-4 py-3">
                <dt className="w-24 shrink-0 text-muted">{k}</dt>
                <dd className="font-semibold">{v}</dd>
              </div>
            ))}
            <div className="flex items-center gap-4 px-4 py-3">
              <dt className="w-24 shrink-0 text-muted">Status</dt>
              <dd><StatusPill status={pack.isDemo ? "demo" : "verified"} /></dd>
            </div>
          </dl>
          <p className="mt-2 text-sm text-muted">Stored inside the app. Routes are worked out on this phone and work without internet.</p>
        </section>

        <section aria-labelledby="privacy-h">
          <h2 id="privacy-h" className="mb-2 text-lg font-bold">Privacy</h2>
          <p className="text-sm leading-relaxed">
            This build stores only the settings above, on this phone. It does not use your location or camera yet, and sends nothing over the internet.
          </p>
          <button
            type="button"
            onClick={() => { resetPrefs(); setResetDone(true); }}
            className="mt-3 min-h-12 w-full rounded-xl border-2 border-line bg-card font-semibold"
          >
            Reset settings
          </button>
          <p aria-live="polite" className="mt-2 min-h-5 text-sm text-sign">{resetDone ? "Settings reset to defaults." : ""}</p>
        </section>

        <p className="pb-2 text-center text-xs text-muted">VIT ImmersiveAR development build. Not an official VIT app.</p>
      </div>
    </>
  );
}
