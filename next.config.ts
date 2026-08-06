import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for Docker/containers: `.next/standalone`
  // ships its own minimal node_modules + server.js, so the image doesn't
  // depend on the host's Node/npm. Enabled everywhere EXCEPT Vercel — Vercel
  // builds/deploys natively and `output: "standalone"` breaks its build
  // tracing (missing .next/*.nft.json).
  output: process.env.VERCEL ? undefined : "standalone",
  // Tree-shake large libraries so only the icons/utilities actually used ship.
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "recharts", "motion"],
  },
  // Trim the production source for a smaller, faster payload.
  productionBrowserSourceMaps: false,
};

export default nextConfig;
