import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Increase body size limit for file uploads (10MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
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
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        pathname: '/**'
      },
      {
        protocol: 'https',
        hostname: 'v5.airtableusercontent.com',
        pathname: '/**'
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
        pathname: '/**'
      }
    ],
  },  
  
  // Explicit rewrites for the SDOH routes
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
