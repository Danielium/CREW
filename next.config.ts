import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @ts-ignore - Next.js types might not include allowedDevOrigins
  allowedDevOrigins: [
    "*.pinggy-free.link",
    "*.run.pinggy-free.link",
    "*.pinggy.link",
    "*.loca.lt",
    "*.localhost.run",
    "a.pinggy.io",
    "*.trycloudflare.com",
    "localhost"
  ]
};

export default nextConfig;
