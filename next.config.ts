import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
    ],
  },
  allowedDevOrigins: ["jason-blade"],
};

export default config;
