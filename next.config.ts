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
  },
  
  // Configure dynamic routes
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
    ]
  },

  async rewrites() {
    return {
      beforeFiles: [
        // Handle language-specific routes
        {
          source: '/sdoh',
          destination: '/en/sdoh',
        },
        {
          source: '/SDOH',
          destination: '/en/sdoh',
        },
      ],
    }
  },
};

export default nextConfig;
