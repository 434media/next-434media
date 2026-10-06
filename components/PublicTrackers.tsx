"use client"

import { usePathname } from "next/navigation"
import Script from "next/script"
import { isTrackedPath } from "@/lib/tracking-scope"

/**
 * Google Tag Manager, GA4 and the LinkedIn Insight Tag, on public routes only.
 *
 * These were in the root layout and loaded on every route, so the team's CRM
 * sessions (/admin), travellers' private itineraries (/travel) and the deck
 * (/squads) were recorded alongside customer traffic (2b audit §3). The Meta
 * Pixel was already gated this way; all four now share one list,
 * UNTRACKED_PREFIXES in lib/tracking-scope.ts.
 *
 * Gated on the client because the root layout cannot see the path. usePathname
 * is known during server rendering, so an untracked page's HTML carries none of
 * these tags. A script already running stays loaded after a client-side
 * navigation from a public page into an untracked one; the layout split
 * (2b fix 9) is what ends that, by giving those routes a layout without them.
 *
 * Simpli.fi and Vercel Analytics were removed rather than moved.
 */
export function PublicHeadTrackers() {
  const pathname = usePathname()
  if (!isTrackedPath(pathname)) return null

  return (
    <>
      {/* Google Tag Manager */}
      <Script id="google-tag-manager" strategy="afterInteractive">
        {`
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','GTM-569XSBBR');
        `}
      </Script>
      {/* End Google Tag Manager */}

      {/* Google tag (gtag.js) — fetched after the window load event, by hand.

          Not next/script. `strategy="lazyOnload"` defers EXECUTION but Next
          still emits <link rel="preload" href="...gtag/js..." as="script">
          into the HTML, so the 195.9 KB was fetched early regardless and sat
          in flight 596-4,672 ms, across the whole of the LCP image's load
          window on a throttled mobile link. Measured, not assumed.

          So the fetch is done manually instead: a plain inline script that
          appends the tag on `load`. Next does not preload a URL it never
          sees, which is the entire point.

          The queue is live from parse, deliberately. web.dev: "Analytics
          scripts are usually loaded early so you don't miss any valuable
          analytics data... there are patterns to initialize analytics lazily
          while retaining early page-load data." dataLayer and window.gtag
          exist immediately, so a call made before load is queued and replays
          when the tag arrives. Only the bytes wait.

          readyState is checked first because `load` has already fired on a
          client-side navigation into a fresh mount, and a listener added then
          would never run.

          Public routes only; see the note at the top of this file. */}
      <script
        id="google-analytics"
        dangerouslySetInnerHTML={{
          __html: `
          window.dataLayer = window.dataLayer || [];
          window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
          window.gtag('js', new Date());
          window.gtag('config', 'G-FTWW298D70');
          (function(){
            function l(){
              var s = document.createElement('script');
              s.async = true;
              s.src = 'https://www.googletagmanager.com/gtag/js?id=G-FTWW298D70';
              document.head.appendChild(s);
            }
            if (document.readyState === 'complete') { l(); }
            else { window.addEventListener('load', l); }
          })();
        `,
        }}
      />

      {/* LinkedIn Pixel */}
      <Script id="linkedin-pixel-init" strategy="afterInteractive">
        {`
          _linkedin_partner_id = "7445314";
          window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
          window._linkedin_data_partner_ids.push(_linkedin_partner_id);
        `}
      </Script>
      <Script id="linkedin-pixel" strategy="afterInteractive">
        {`
          (function(l) {
            if (!l){window.lintrk = function(a,b){window.lintrk.q.push([a,b])};
            window.lintrk.q=[]}
            var s = document.getElementsByTagName("script")[0];
            var b = document.createElement("script");
            b.type = "text/javascript";b.async = true;
            b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
            s.parentNode.insertBefore(b, s);
          })(window.lintrk);
        `}
      </Script>
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src="https://px.ads.linkedin.com/collect/?pid=7445314&fmt=gif"
        />
      </noscript>
    </>
  )
}

/** GTM's noscript fallback, which belongs at the top of <body>. Same gate. */
export function PublicBodyTrackers() {
  const pathname = usePathname()
  if (!isTrackedPath(pathname)) return null

  return (
    <noscript>
      <iframe
        src="https://www.googletagmanager.com/ns.html?id=GTM-569XSBBR"
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
      />
    </noscript>
  )
}
