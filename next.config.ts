import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default (1 MB) reicht nicht für mehrere Tagebuch-Fotos pro Eintrag.
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
