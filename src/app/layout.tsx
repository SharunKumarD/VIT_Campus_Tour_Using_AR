import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { BackButtonHandler } from "@/components/BackButtonHandler.tsx";
import { BottomNav } from "@/components/BottomNav.tsx";
import "./globals.css";

export const metadata: Metadata = {
  title: "VIT ImmersiveAR",
  description: "Campus navigation with step-free routing. Development build using demo data.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0e5a3c",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <main className="mx-auto max-w-xl pb-[calc(5rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
          {children}
        </main>
        <BottomNav />
        <BackButtonHandler />
      </body>
    </html>
  );
}
