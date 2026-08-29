/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  // _prototype/ holds the old Express version; keep it out of the compile
  outputFileTracingExcludes: { "*": ["./_prototype/**"] },
};

export default nextConfig;
