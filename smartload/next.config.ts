import type { NextConfig } from "next";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${BACKEND_URL}/:path*`,
      },
      {
        source: "/static/:path*",
        destination: `${BACKEND_URL}/static/:path*`,
      },
    ];
  },
};

export default nextConfig;
