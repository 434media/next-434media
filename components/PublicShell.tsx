import type React from "react"
import { Suspense } from "react"
import { CombinedNavbar } from "@/components/combined-navbar"
import Footer from "@/components/Footer"
import { PageTransition } from "@/components/shopify/page-transition"
import { MetaPixel } from "@/components/MetaPixel"
import { PublicHeadTrackers, PublicBodyTrackers } from "@/components/PublicTrackers"
import { BRAND } from "@/lib/seo/brand"
import { BRAND_RECORDS } from "@/lib/brand-records"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"

/**
 * Everything a public page carries that the admin portal, the travel
 * itineraries and the squads deck must not: structured data, the trackers and
 * the site chrome. Rendered by app/(site)/layout.tsx, app/(shop)/layout.tsx and
 * app/not-found.tsx; the root layout carries none of it (2b fix 9).
 *
 * `cart` is the (shop) layout's navbar cart button; nothing else passes one.
 *
 * Nothing here reads cookies or headers, so it does not make a page dynamic.
 * The Meta Pixel's jurisdiction gate lives in proxy.ts.
 */
export function PublicShell({
  children,
  cart,
}: {
  children: React.ReactNode
  cart?: React.ReactNode
}) {
  return (
    <>
      {/* Structured Data: Organization & WebSite with potential SearchAction */}
      <script
        type="application/ld+json"
        // Keep this lightweight & generated server-side (no dynamic client data required)
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: BRAND.name,
            alternateName: '434 Media',
            slogan: BRAND_RECORDS.mottoPlain,
            description: BRAND.description,
            url: siteUrl,
            logo: `${siteUrl}/api/og`,
            sameAs: [
              'https://www.facebook.com/434media',
              'https://www.linkedin.com/company/434media',
              'https://x.com/434media',
              'https://www.instagram.com/digitalcanvas.community'
            ],
            contactPoint: [{
              '@type': 'ContactPoint',
              contactType: 'customer support',
              email: 'build@434media.com',
              availableLanguage: ['en','es']
            }]
          })
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: '434 MEDIA',
            url: siteUrl,
            potentialAction: {
              '@type': 'SearchAction',
              target: `${siteUrl}/search?q={search_term_string}`,
              'query-input': 'required name=search_term_string'
            }
          })
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ProfessionalService',
            '@id': `${siteUrl}/#localbusiness`,
            name: BRAND.name,
            alternateName: '434 Media',
            slogan: BRAND_RECORDS.mottoPlain,
            url: siteUrl,
            image: `${siteUrl}/api/og`,
            logo: `${siteUrl}/api/og`,
            email: 'build@434media.com',
            description: BRAND.description,
            address: {
              '@type': 'PostalAddress',
              streetAddress: '816 Camaron St., Suite 1.11',
              addressLocality: 'San Antonio',
              addressRegion: 'TX',
              postalCode: '78212',
              addressCountry: 'US'
            },
            areaServed: [
              { '@type': 'City', name: 'San Antonio' },
              { '@type': 'State', name: 'Texas' }
            ],
            knowsAbout: [
              'Brand storytelling',
              'Video production',
              'Event production'
            ],
            sameAs: [
              'https://www.facebook.com/434media',
              'https://www.linkedin.com/company/434media',
              'https://x.com/434media',
              'https://www.instagram.com/digitalcanvas.community'
            ]
          })
        }}
      />
      {/* GTM, GA4 and LinkedIn — see components/PublicTrackers.tsx */}
      <PublicHeadTrackers />

      {/* Meta Pixel — gated by route and jurisdiction; see components/MetaPixel.tsx */}
      <MetaPixel pixelId={process.env.META_PIXEL_ID || ""} />

      {/* GTM (noscript) */}
      <PublicBodyTrackers />

      <Suspense>
        <CombinedNavbar cart={cart} />
      </Suspense>
      <main>
        <PageTransition>{children}</PageTransition>
      </main>
      <Footer />
    </>
  )
}
