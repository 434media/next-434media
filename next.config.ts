import type { NextConfig } from "next";
import { withBotId } from 'botid/next/config';
import { REMOTE_IMAGE_PATTERNS } from './lib/image-hosts';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Increase body size limit for file uploads (App Router uses route config, not this)
  // The Create table's video conversion (lib/content-pipeline/transcode.ts) runs the ffmpeg-static binary: kept out of
  // the bundle and traced into that one route.
  serverExternalPackages: ['ffmpeg-static'],
  outputFileTracingIncludes: {
    // The binary's real path under pnpm's store: node_modules/ffmpeg-static is a symlink, and a traced path through a
    // symlinked directory makes Vercel refuse the function ("files in symlinked directories").
    '/api/admin/content/media-optimize': ['./node_modules/.pnpm/ffmpeg-static@*/node_modules/ffmpeg-static/ffmpeg'],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    // One list, shared with isOptimizableImage (lib/image-hosts.ts).
    remotePatterns: REMOTE_IMAGE_PATTERNS.map((p) => ({ ...p })),
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

  // The CRM section was renamed to Opportunities and moved to /admin/opportunities.
  // Keep every old link working — bookmarks, command palette, cron/notification
  // deep-links — with query strings + sub-paths (e.g. /settings) preserved.
  async redirects() {
    return [
      { source: '/admin/crm', destination: '/admin/opportunities', permanent: false },
      { source: '/admin/crm/:path*', destination: '/admin/opportunities/:path*', permanent: false },
      // Prospect promoted from a Leads child to a top-level pipeline route.
      { source: '/admin/leads/prospect', destination: '/admin/prospect', permanent: false },
      // AI Studio promoted from a Content child to its own top-level route.
      { source: '/admin/content/studio', destination: '/admin/studio', permanent: false },
    ]
  },
};

export default withBotId(nextConfig);
