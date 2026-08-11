import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack(config) {
    // Vercel caches /_next/static chunks as immutable for one year. Salting
    // content hashes with the deployment commit prevents a browser from
    // reusing an older shared chunk when its numeric chunk id stays stable.
    config.output.hashSalt = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "local-development";
    return config;
  }
};

export default nextConfig;