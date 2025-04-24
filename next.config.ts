import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ampd-asset.s3.us-east-2.amazonaws.com",
      },
    ],
    // unoptimized: true, // Removed unoptimized: true
  },
  async redirects() {
    return [
      {
        source: '/SDOH',
        destination: '/sdoh',
        permanent: true,
        // Add this to prevent redirect loops
        basePath: false,
      },
      // You can add more case-insensitive redirects if needed
      {
        source: '/Sdoh',
        destination: '/sdoh',
        permanent: true,
        // Add this to prevent redirect loops
        basePath: false,
      },
    ];
  },
};

export default nextConfig;
