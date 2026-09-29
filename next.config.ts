import type { NextConfig } from "next";
import { withBotId } from 'botid/next/config';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Increase body size limit for file uploads (App Router uses route config, not this)
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "/groovy-ego-462522-v2.firebasestorage.app/**",
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
        hostname: '*.public.blob.vercel-storage.com',
        pathname: '/**'
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
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

  // The CRM section was renamed to Opportunities and moved to /admin/opportunities.
  // Keep every old link working — bookmarks, command palette, cron/notification
  // deep-links — with query strings + sub-paths (e.g. /settings) preserved.
  async redirects() {
    return [
      // The Work page is offline in PRODUCTION ONLY. Previews serve it, so it
      // can be reviewed and approved before it goes public — which is one of
      // the conditions for removing this rule.
      //
      // Why it is off: it goes live with the site relaunch and outbound, not
      // before. app/work/page.tsx, the generated records and the CI check are
      // all untouched and passing; this rule is the only thing hiding it.
      //
      // Remove it when ALL THREE hold:
      //   1. the relaunch goes live with outbound;
      //   2. the founder has approved the Work page on a preview deployment;
      //   3. every published portfolio record has approved artwork (IMP-28 —
      //      verify-work-page.ts gains the Card-still assertion after the asset
      //      pass, and that assertion passing is the check for this condition).
      //
      // Tracked as a line item in the outbound go-live session of the forward
      // plan. It said "Temporary" with no date and no condition for two weeks,
      // which is how a temporary rule becomes a permanent one nobody can argue
      // with.
      ...(process.env.VERCEL_ENV === 'production'
        ? [{ source: '/work', destination: '/', permanent: false }]
        : []),
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
