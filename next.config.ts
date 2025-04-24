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
        permanent: false,
        basePath: false,
        // Only redirect exact matches
        has: [
          {
            type: 'host',
            value: '434media.com',
          },
        ],
      }
    ];
  },
};

export default nextConfig;
