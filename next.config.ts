import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Output standalone for optimized Lambda deployment
  output: 'standalone',
  
  // Use SWC minification for faster builds
  swcMinify: true,
  
  // Keep your existing configurations
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
  
  // Improved cache control headers
  async headers() {
    return [
      {
        // No caching for HTML/API routes
        source: '/:path*',
        has: [
          {
            type: 'header',
            key: 'Accept',
            value: '.*text/html.*',
          },
        ],
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
    ];
  },
  
  // Keep your existing rewrites
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
    };
  },
  
  // Optimize memory usage during builds
  experimental: {
    // Enable memory optimizations for large builds
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    // Improve tree-shaking
    optimizeCss: true,
  },
};

export default nextConfig;