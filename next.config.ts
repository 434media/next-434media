import type { NextConfig } from "next";

const nextConfig: NextConfig = {
/*   eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  }, */

  /*  experimental: {
    useCache: true,
  }, */

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ampd-asset.s3.us-east-2.amazonaws.com",
      },
       {
        protocol: 'https',
        hostname: 'cdn.shopify.com',
        pathname: '/s/files/**'
      }
    ],
  },  
  
  // Add explicit rewrites for the SDOH routes
  async rewrites() {
    return {
      beforeFiles: [
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
