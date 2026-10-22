import type { NextConfig } from "next";

// VIT ImmersiveAR — static export for Capacitor.
// Cache Components / Partial Prefetching removed: they require a server
// and are not supported with static export.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
