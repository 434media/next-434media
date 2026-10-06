import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import localFont from "next/font/local"
import "./globals.css"
import { CombinedNavbar } from "@/components/combined-navbar"
import { BRAND } from "@/lib/seo/brand"
import { BRAND_RECORDS } from "@/lib/brand-records"
import Footer from "@/components/Footer"
import { getCart } from "@/lib/shopify"
import { CartProvider } from "@/components/shopify/cart/cart-context"
import { PageTransition } from "@/components/shopify/page-transition"
import { Suspense } from "react"
import { headers } from "next/headers"
import { MetaPixel } from "@/components/MetaPixel"
import { PublicHeadTrackers, PublicBodyTrackers } from "@/components/PublicTrackers"
import { EXCLUDED_COUNTRY_CODES } from "@/lib/prospecting/scorer"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
})

// Geist Mono and Menda Black are NOT preloaded.
//
// Measured on the Work page at both Lighthouse presets: the first screen renders
// in Geist and GGX88 only, and those are the only two faces the browser reports
// as loaded. next/font preloads every face by default, so all four were being
// fetched in the critical window — about 105 KB competing with the LCP image on
// a throttled link.
//
// web.dev's font best practices: preload "comes at the cost of taking away
// browser resources from the loading of other resources", and preloading should
// be selective. Both keep display: swap, so when a later screen needs them the
// text renders immediately in the fallback and swaps.
//
// SITE-WIDE — these are declared in the root layout. No typeface, weight or
// visual changes; only when the file is fetched.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
})

const mendaBlack = localFont({
  src: "../fonts/Menda-Black.otf",
  variable: "--font-menda-black",
  display: "swap",
  preload: false,
})

const ggx88Font = localFont({
  src: "../fonts/GGX88.otf",
  variable: "--font-ggx88",
  display: "swap",
})

// Define the base URL for the site
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"

const defaultTitle = `${BRAND.name} — ${BRAND_RECORDS.shortDescriptor}`

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    template: `%s | ${BRAND.name}`,
    default: defaultTitle,
  },
  description: BRAND.description,
  keywords: [
    BRAND.name,
    "brand campaigns",
    "event production",
    "creative media agency",
    "brand storytelling",
    "video production",
    "web development",
    "programmatic advertising",
    "OTT and CTV",
    "San Antonio",
    "South Texas",
    "Texas",
  ],
  authors: [{ name: BRAND.name }],
  creator: BRAND.name,
  publisher: BRAND.name,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
    languages: {
      "en-US": `${siteUrl}/`,
      "es-ES": `${siteUrl}/es`,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: BRAND.name,
    title: defaultTitle,
    description: BRAND.description,
    // Image is auto-wired by app/opengraph-image.tsx (Next file convention)
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: BRAND.description,
    creator: "@434media",
    site: "@434media",
    // Image is auto-wired by app/twitter-image.tsx (Next file convention)
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
    other: {
      rel: "apple-touch-icon-precomposed",
      url: "/apple-touch-icon-precomposed.png",
    },
  },
  verification: {
    // Add your verification codes if you have them
    // google: "your-google-verification-code",
    // yandex: "your-yandex-verification-code",
  },
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  minimumScale: 1,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Don't await the fetch, pass the Promise to the context provider
  const cart = getCart()

  // Meta Pixel jurisdiction gate. The pixel sets cookies before any consent is
  // given, so it does not run for visitors in the GDPR/CASL jurisdictions 434
  // already excludes from outbound (EXCLUDED_COUNTRY_CODES, lib/prospecting/
  // scorer.ts). Country comes from the edge geo header, which only exists on
  // Vercel — locally it's absent and the pixel runs, matching production for
  // US traffic. Missing header fails OPEN because the alternative would be no
  // pixel anywhere in dev; the jurisdictions that matter are behind the CDN.
  const visitorCountry = (await headers()).get("x-vercel-ip-country")?.toUpperCase()
  const pixelAllowed = !visitorCountry || !EXCLUDED_COUNTRY_CODES.has(visitorCountry)
  const metaPixelId = pixelAllowed ? process.env.META_PIXEL_ID || "" : ""

  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
  {/* Basic hreflang links for primary locales */}
  <link rel="alternate" hrefLang="en" href={`${siteUrl}/`} />
  <link rel="alternate" hrefLang="es" href={`${siteUrl}/es`} />
  <link rel="alternate" hrefLang="x-default" href={`${siteUrl}/`} />

        {/* GTM, GA4 and LinkedIn: public routes only — see components/PublicTrackers.tsx */}
        <PublicHeadTrackers />

        {/* Meta Pixel — gated by route and jurisdiction; see components/MetaPixel.tsx */}
        <MetaPixel pixelId={metaPixelId} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${mendaBlack.variable} ${ggx88Font.variable} antialiased min-h-screen flex flex-col`}
      >
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
                { '@type': 'State', name: 'Texas' },
                { '@type': 'Place', name: 'South Texas' }
              ],
              knowsAbout: [
                'Creative media',
                'Brand storytelling',
                'Video production',
                'Web development',
                'Programmatic advertising',
                'OTT and CTV advertising',
                'Event production',
                'Multichannel marketing',
                'Smart marketing',
                'Media strategy',
                'Digital marketing'
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
        {/* GTM (noscript): public routes only */}
        <PublicBodyTrackers />

        <CartProvider cartPromise={cart}>
          <Suspense>
<CombinedNavbar />
          </Suspense>
          <main>
            <PageTransition>{children}</PageTransition>
          </main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  )
}
