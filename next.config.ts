import type { NextConfig } from "next";

const API_BASE = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: [
    "hqids.carnotresearch.com",
    "34.131.42.251",
    "*.ngrok-free.dev",
    "*.ngrok-free.app",
    "*.ngrok.io",
  ],
  experimental: {
   proxyTimeout: 1800000,
  },
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [
        {
          source: "/api/:path((?!docs/).*)*",
          destination: `${API_BASE}/api/:path*`,
        },
        {
          source: "/static/:path*",
          destination: `${API_BASE}/static/:path*`,
        },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;
