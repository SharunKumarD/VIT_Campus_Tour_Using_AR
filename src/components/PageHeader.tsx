import Link from "next/link";
import type { ReactNode } from "react";
import { BackIcon } from "./icons.tsx";

export function PageHeader({ title, back, children }: { title: string; back?: string; children?: ReactNode }) {
  return (
    <header className="bg-sign px-4 pb-4 pt-3 text-white">
      <div className="flex min-h-12 items-center gap-1">
        {back ? (
          <Link href={back} aria-label="Back" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10">
            <BackIcon />
          </Link>
        ) : null}
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      </div>
      {children}
    </header>
  );
}
