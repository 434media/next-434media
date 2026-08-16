"use client"

import { usePathname } from "next/navigation"
import Script from "next/script"

/**
 * Meta Pixel, gated.
 *
 * This used to be an inline <script> in the root layout with the pixel ID
 * hardcoded, which meant three things:
 *   1. The ID was duplicated — the literal here and `META_PIXEL_ID` in
 *      lib/meta-server-tracking.ts (the Conversions API). Rotating the pixel
 *      changed one and silently left the other pointing at the old one. The ID
 *      is now passed in from the server layout, read from the same env var.
 *   2. It fired on every route, `/admin` included, so the team's own CRM
 *      sessions were tracked into the same pixel as customer traffic.
 *   3. It fired for every visitor pre-consent, including EU/UK/EEA/Swiss and
 *      Canadian ones — inconsistent with the outbound posture 434 already
 *      holds in `EXCLUDED_COUNTRIES`. The jurisdiction gate is upstream in the
 *      server layout, which is the only place the visitor's country is known.
 *
 * Route gating has to happen client-side: the root layout renders once per
 * server request, so a client-side navigation into /admin would otherwise keep
 * a pixel mounted that was allowed on the entry route.
 */

/** Surfaces that are never tracked — internal tooling and the full-screen deck. */
const UNTRACKED_PREFIXES = ["/admin", "/squads"]

export function MetaPixel({ pixelId }: { pixelId: string }) {
  const pathname = usePathname()

  if (!pixelId) return null
  if (UNTRACKED_PREFIXES.some((p) => pathname?.startsWith(p))) return null

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', ${JSON.stringify(pixelId)});
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${encodeURIComponent(pixelId)}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  )
}
