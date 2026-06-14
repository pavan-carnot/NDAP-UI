import type { NextConfig } from "next";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  experimental: {
    proxyTimeout: 120000,
  },
 
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_BASE}/api/:path*`,
      },
      {
        source: "/static/:path*",
        destination: `${API_BASE}/static/:path*`,
      },
    ];
  },
};

export default nextConfig;
