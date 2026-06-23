import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.resolve(process.cwd()),
  turbopack: {
    root: path.resolve(process.cwd())
  }
};

export default nextConfig;
