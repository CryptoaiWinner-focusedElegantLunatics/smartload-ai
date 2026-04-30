import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,

  async rewrites() {
    const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";
    return [
      { source: "/api/backend/:path*", destination: `${backendUrl}/:path*` },
      { source: "/static/:path*", destination: `${backendUrl}/static/:path*` },
    ];
  },

  async headers() {
    // ✅ Chronione trasy — przeglądarka NIE może ich cache'ować
    const noStorePaths = [
      "/dashboard/:path*",
      "/mail/:path*",
      "/chat/:path*",
      "/loads/:path*",
      "/my-routes/:path*",
      "/compare/:path*",
      "/settings/:path*",
    ];

    const noStoreHeaders = [
      {
        key: "Cache-Control",
        value: "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
      { key: "Pragma", value: "no-cache" },
      { key: "Expires", value: "0" },
      // ✅ Bezpieczeństwo
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ];

    return noStorePaths.map((source) => ({ source, headers: noStoreHeaders }));
  },
};

export default nextConfig;
