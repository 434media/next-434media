import { jsonLdScript } from "@/lib/json-ld"
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
      {/* Structured data: the Organization, the WebSite and the
          ProfessionalService, joined by @id so search engines and agents read
          them as one entity.

          - logo: a 512px square PNG of the supplied stacked lockup on white,
            public/brand/434-logo-512.png, rendered from
            public/brand/434-stacked-dark.svg (byte-identical to
            07 Visual System/logos). It was /api/og, a 1200x630 social card,
            and search engines read this field for the logo beside a result.
          - sameAs lists 434 MEDIA's own profiles only. It carried
            instagram.com/digitalcanvas.community, Digital Canvas's account,
            which tied 434's identity to another brand. 434 has no Instagram.
          - The WebSite no longer declares a SearchAction. Its target, /search,
            is the shop's product search ("Search | 434 MEDIA Store"), and
            Google retired the sitelinks search box it fed in 2024.
          - founder: master 8.1, "Marcos Resendez is the founder of 434 MEDIA". */}
      <script
        type="application/ld+json"
        // Keep this lightweight & generated server-side (no dynamic client data required)
        dangerouslySetInnerHTML={{
          __html: jsonLdScript({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            '@id': `${siteUrl}/#organization`,
            name: BRAND.name,
            alternateName: '434 Media',
            slogan: BRAND_RECORDS.mottoPlain,
            description: BRAND.description,
            url: siteUrl,
            logo: `${siteUrl}/brand/434-logo-512.png`,
            founder: { '@type': 'Person', name: 'Marcos Resendez' },
            sameAs: [
              'https://www.facebook.com/434media',
              'https://www.linkedin.com/company/434media',
              'https://x.com/434media'
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
          __html: jsonLdScript({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            '@id': `${siteUrl}/#website`,
            name: '434 MEDIA',
            url: siteUrl,
            publisher: { '@id': `${siteUrl}/#organization` }
          })
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript({
            '@context': 'https://schema.org',
            '@type': 'ProfessionalService',
            '@id': `${siteUrl}/#localbusiness`,
            name: BRAND.name,
            alternateName: '434 Media',
            slogan: BRAND_RECORDS.mottoPlain,
            url: siteUrl,
            image: `${siteUrl}/opengraph-image`,
            logo: `${siteUrl}/brand/434-logo-512.png`,
            parentOrganization: { '@id': `${siteUrl}/#organization` },
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
              'https://x.com/434media'
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
