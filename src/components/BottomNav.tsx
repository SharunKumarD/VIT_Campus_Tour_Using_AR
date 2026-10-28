"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BuildingIcon, HomeIcon, MapIcon, SearchIcon, SettingsIcon } from "./icons.tsx";

const TABS = [
  { href: "/", label: "Home", Icon: HomeIcon, match: (p: string) => p === "/" },
  { href: "/landmarks/", label: "Campus", Icon: BuildingIcon, match: (p: string) => p.startsWith("/landmark") },
  { href: "/places/", label: "Places", Icon: SearchIcon, match: (p: string) => p.startsWith("/places") || p.startsWith("/place") },
  { href: "/map/", label: "Map", Icon: MapIcon, match: (p: string) => p.startsWith("/map") },
  { href: "/settings/", label: "Settings", Icon: SettingsIcon, match: (p: string) => p.startsWith("/settings") },
];

export function BottomNav() {
  const pathname = usePathname() || "/";
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-xl">
        {TABS.map(({ href, label, Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold ${
                  active ? "text-sign" : "text-muted"
                }`}
              >
                <span className={`flex h-8 w-14 items-center justify-center rounded-full ${active ? "bg-sign/10" : ""}`}>
                  <Icon className="h-6 w-6" />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
