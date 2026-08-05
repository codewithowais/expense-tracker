import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for Docker/containers: `.next/standalone`
  // ships its own minimal node_modules + server.js, so the image doesn't
  // depend on the host's Node/npm. Vercel ignores this and builds normally.
  output: "standalone",
  // Tree-shake large libraries so only the icons/utilities actually used ship.
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "recharts", "motion"],
  },
  // Trim the production source for a smaller, faster payload.
  productionBrowserSourceMaps: false,
};

export default nextConfig;
