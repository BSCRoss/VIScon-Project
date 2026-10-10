import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating "N" dev badge overlapped the bottom navigation on phones.
  devIndicators: false,
  images: {
    // Dish photos are proxied and resized through /_next/image so they work on any network and load fast on phones.
    remotePatterns: [
      { protocol: "https", hostname: "idapps.ethz.ch" },
      { protocol: "https", hostname: "app.food2050.ch" },
      { protocol: "https", hostname: "**.food2050.ch" },
    ],
  },
};

export default nextConfig;
