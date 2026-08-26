import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow large image uploads for question media
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
