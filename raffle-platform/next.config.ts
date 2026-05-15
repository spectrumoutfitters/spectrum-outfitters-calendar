import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: rootDir,
  },
  async redirects() {
    return [
      { source: "/u/:slug", destination: "/e/:slug", permanent: false },
      { source: "/u/:slug/live", destination: "/e/:slug/live", permanent: false },
      { source: "/u/:slug/my-entry", destination: "/e/:slug/my-entry", permanent: false },
      { source: "/u/:slug/buy/success", destination: "/e/:slug/buy/success", permanent: false },
    ];
  },
  // Staff app (login.*) embeds /admin/* in an iframe — allow framing (no X-Frame-Options: SAMEORIGIN).
  async headers() {
    return [
      {
        source: "/admin/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://login.spectrumoutfitters.com",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
