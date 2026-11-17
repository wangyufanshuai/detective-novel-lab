import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  outputFileTracingRoot: path.resolve(process.cwd()),
  experimental: {
    cpus: 4
  },
  // Fonts and town assets requested with ?v=<content hash> never change at that URL.
  // Unversioned requests (fonts.css, manifests) keep the default revalidation.
  async headers() {
    const immutable = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];
    const versioned = [{ type: "query" as const, key: "v" }];
    return [
      { source: "/fonts/noir/:file*", has: versioned, headers: immutable },
      { source: "/assets/:path*", has: versioned, headers: immutable }
    ];
  },
  turbopack: {
    root: path.resolve(process.cwd())
  }
};

export default nextConfig;
