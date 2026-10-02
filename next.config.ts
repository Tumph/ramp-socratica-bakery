import type { NextConfig } from "next";

// The application is deployed as a Cloudflare Worker. The default Next.js
// server output keeps local `next start` available without requiring a
// Node/Docker standalone artifact during the Workers build.
const nextConfig: NextConfig = {};

export default nextConfig;
