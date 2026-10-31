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
    // The social-image routes read Menda's OTF at runtime. It's fetched at build time and gitignored
    // (scripts/fonts/fetch-private-fonts.mjs), so name it rather than rely on the tracer finding it.
    '/opengraph-image': ['./fonts/Menda-Black.otf'],
    '/api/og': ['./fonts/Menda-Black.otf'],
    '/deck/[shareId]/opengraph-image': ['./fonts/Menda-Black.otf'],
  },
  experimental: {
    // forbidden() for the founder-only finance page, so a non-founder gets a real 403 (lib/founder-guard.ts).
    authInterrupts: true,
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

  // A brand book shared with a vendor (plan v11.2.1 Step 4 item 4): the link carries its access token, so the page is
  // never indexed and no referrer leaves it, as response headers as well as the page's own meta tags.
  async headers() {
    return [
      {
        source: '/share/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
    ]
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
