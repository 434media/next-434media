import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ampd-asset.s3.us-east-2.amazonaws.com",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/SDOH',
        destination: '/sdoh',
        permanent: true,
      },
      // You can add more case-insensitive redirects if needed
      {
        source: '/Sdoh',
        destination: '/sdoh',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
