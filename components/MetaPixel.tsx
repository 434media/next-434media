"use client"

import { useSyncExternalStore } from "react"
import { usePathname } from "next/navigation"
import Script from "next/script"
import { isTrackedPath, META_PIXEL_COOKIE } from "@/lib/tracking-scope"

/**
 * Meta Pixel, gated by route and by jurisdiction.
 *
 * Route: /admin, /travel and /squads never load it (UNTRACKED_PREFIXES in
 * lib/tracking-scope.ts). Those routes also sit outside the public layouts, so
 * this component is not rendered there at all; the check stays as a backstop.
 *
 * Jurisdiction: decided per request in proxy.ts, which sets `434_px=1` only for
 * visitors allowed to receive the pixel (lib/meta-pixel-gate.ts). It used to be
 * decided in the root layout from the geo header, which made every page render
 * per request; reading a cookie on the client lets public pages be cached
 * (2b fix 9). The cookie arrives with the page response, so the first page view
 * already sees it.
 *
 * There is no <noscript> image any more: the server no longer knows the
 * visitor's country, so it could not gate one (founder decision, 2026-10-07).
 */

const subscribe = () => () => {}
const readAllowed = () =>
  document.cookie.split("; ").some((c) => c === `${META_PIXEL_COOKIE}=1`)
// The server never knows the visitor's country, so it never renders the pixel.
const serverAllowed = () => false

export function MetaPixel({ pixelId }: { pixelId: string }) {
  const pathname = usePathname()
  const allowed = useSyncExternalStore(subscribe, readAllowed, serverAllowed)

  if (!pixelId || !allowed) return null
  if (!isTrackedPath(pathname)) return null

  return (
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
  )
}
