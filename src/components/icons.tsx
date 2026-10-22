/** Small inline SVG icons (no icon library, nothing downloaded at runtime). */

import type { ReactNode } from "react";
import type { PoiCategory } from "@/lib/campus/types.ts";

type IconProps = { className?: string; title?: string };

function Svg({ className, title, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? "h-6 w-6"}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const HomeIcon = (p: IconProps) => (
  <Svg {...p}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></Svg>
);
export const SearchIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></Svg>
);
export const MapIcon = (p: IconProps) => (
  <Svg {...p}><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></Svg>
);
export const SettingsIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></Svg>
);
export const ChevronIcon = (p: IconProps) => (
  <Svg {...p}><path d="M9 6l6 6-6 6" /></Svg>
);
export const BackIcon = (p: IconProps) => (
  <Svg {...p}><path d="M15 6l-6 6 6 6" /></Svg>
);
export const SwapIcon = (p: IconProps) => (
  <Svg {...p}><path d="M7 4v16M4 7l3-3 3 3M17 20V4M14 17l3 3 3-3" /></Svg>
);
/** International Symbol of Access, simplified. */
export const AccessIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="4" r="1.6" fill="currentColor" stroke="none" />
    <path d="M11 7v6h5l2 5" />
    <path d="M8 10.5a5 5 0 1 0 6.5 7" />
  </Svg>
);

const CATEGORY_PATHS: Record<PoiCategory, ReactNode> = {
  academic: <><path d="M3 9l9-5 9 5-9 5z" /><path d="M7 11v5c3 2 7 2 10 0v-5" /></>,
  library: <><path d="M4 5h5a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H4z" /><path d="M20 5h-5a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h6z" /></>,
  laboratory: <><path d="M9 3h6M10 3v6L5 19a1 1 0 0 0 1 1.5h12A1 1 0 0 0 19 19l-5-10V3" /></>,
  administration: <><rect x="4" y="4" width="16" height="16" rx="1" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  hostel: <><path d="M3 20V9l9-5 9 5v11" /><path d="M9 20v-6h6v6" /></>,
  food: <><path d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10" /><path d="M17 3c-2 0-3 3-3 6s1 4 3 4v8" /></>,
  medical: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8v8M8 12h8" /></>,
  sports: <><circle cx="12" cy="12" r="8" /><path d="M4 12h16M12 4a12 12 0 0 1 0 16M12 4a12 12 0 0 0 0 16" /></>,
  "student-services": <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  entrance: <><path d="M4 21V5l8-2v18" /><path d="M12 5h6v16M15 12h.01" /></>,
};

export function CategoryIcon({ category, className }: { category: PoiCategory; className?: string }) {
  return <Svg className={className}>{CATEGORY_PATHS[category]}</Svg>;
}
