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
  turbopack: {
    root: path.resolve(process.cwd())
  }
};

export default nextConfig;
