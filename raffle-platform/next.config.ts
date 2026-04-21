import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: rootDir,
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
