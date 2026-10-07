import type { Metadata } from "next"
import HomeClient from "./HomeClient"
import { buildServicesItemListLd } from "@/lib/seo/services"
import { buildFaqPageLd } from "@/lib/seo/faq"
import { BRAND } from "@/lib/seo/brand"
import { BRAND_RECORDS } from "@/lib/brand-records"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"
const homeTitle = `${BRAND.name} — ${BRAND_RECORDS.shortDescriptor}`

export const metadata: Metadata = {
  title: homeTitle,
  description: BRAND.description,
  // Master 9.7's production-search concepts, verbatim and in its order.
  keywords: [
    "production studio",
    "production company",
    "original IP",
    "brand studio",
    "live-event production",
    "documentary production",
    "executive producer",
    "Salute to Troops",
    "TXMX Boxing",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: homeTitle,
    description: BRAND.description,
    url: `${siteUrl}/`,
    siteName: BRAND.name,
    locale: "en_US",
    type: "website",
    // Image is auto-wired by app/opengraph-image.tsx (statically prerendered).
  },
  twitter: {
    card: "summary_large_image",
    title: homeTitle,
    description: BRAND.description,
    creator: "@434media",
    site: "@434media",
    // Image is auto-wired by app/twitter-image.tsx.
  },
}

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildServicesItemListLd(siteUrl, `${siteUrl}/`)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildFaqPageLd()),
        }}
      />
      <HomeClient />
    </>
  )
}
