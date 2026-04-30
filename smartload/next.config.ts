import type { NextConfig } from "next";

/**
 * BACKEND_URL:
 * - lokalnie:  automatycznie http://localhost:8000 (fallback)
 * - Railway:   ustaw jako Build Variable w dashboardzie:
 *              BACKEND_URL=https://twoj-backend.up.railway.app
 *              LUB (jeśli oba serwisy w tym samym projekcie Railway):
 *              BACKEND_URL=http://backend.railway.internal:8000
 */
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,

  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendUrl}/:path*`,
      },
      {
        // Pliki statyczne backendu (np. /static/uploads/...)
        // UWAGA: nie koliduje z /_next/static/ bo Next używa innej ścieżki
        source: "/static/:path*",
        destination: `${backendUrl}/static/:path*`,
      },
    ];
  },

  async headers() {
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
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ];

    return noStorePaths.map((source) => ({ source, headers: noStoreHeaders }));
  },
};

export default nextConfig;
