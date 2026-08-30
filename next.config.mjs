import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  // photo uploads go through Server Actions as base64 — the default 1 MB
  // request cap is too small (see lib/media.ts MAX_UPLOAD_BYTES)
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
  // this project has its own lockfile; don't trace the whole home dir
  outputFileTracingRoot: here,
  // _prototype/ holds the old Express version; keep it out of tracing
  outputFileTracingExcludes: { "*": ["./_prototype/**"] },
};

export default nextConfig;
