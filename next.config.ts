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
  // Remove the redirects configuration since we're using middleware
  experimental: {
    // Any existing experimental options
  },
  
  // Configure dynamic routes
  async headers() {
    return [
      {
        source: '/:lang/sdoh',
        headers: [
          {
            key: 'x-nextjs-data',
            value: '1',
          },
        ],
      },
    ]
  },
};

export default nextConfig;
