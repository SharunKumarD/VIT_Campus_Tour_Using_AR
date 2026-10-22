import type { ProvenanceStatus } from "@/lib/campus/types.ts";

/**
 * Tells the user, every time it matters, that the map is not verified.
 * Required by the project's data-integrity rules: demo data must never look real.
 */
export function DataNotice({ status, compact = false }: { status: ProvenanceStatus; compact?: boolean }) {
  if (status === "verified") return null;
  const [title, text] =
    status === "demo"
      ? ["Demo data.", "These places and paths are invented for testing and are not VIT Vellore."]
      : ["Unverified data.", "Part of this route has not been checked on site. Follow signs on the way."];
  return (
    <p
      role="note"
      className={`rounded-lg bg-demo-soft text-demo ${compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"} leading-snug`}
    >
      <strong className="font-semibold">{title}</strong> {text}
    </p>
  );
}

export function StatusPill({ status }: { status: ProvenanceStatus }) {
  const styles: Record<ProvenanceStatus, string> = {
    verified: "bg-sign/10 text-sign",
    unverified: "bg-demo-soft text-demo",
    demo: "bg-demo-soft text-demo",
  };
  const label: Record<ProvenanceStatus, string> = { verified: "Verified", unverified: "Unverified", demo: "Demo" };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${styles[status]}`}>{label[status]}</span>;
}
