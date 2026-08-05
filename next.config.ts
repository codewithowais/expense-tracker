import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tree-shake large libraries so only the icons/utilities actually used ship.
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "recharts", "motion"],
  },
  // Trim the production source for a smaller, faster payload.
  productionBrowserSourceMaps: false,
};

export default nextConfig;
