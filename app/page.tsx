import type { Metadata } from "next"
import HomeClient from "./HomeClient"
import { buildServicesItemListLd } from "@/lib/seo/services"
import { buildFaqPageLd } from "@/lib/seo/faq"
import { BRAND } from "@/lib/seo/brand"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"
const homeTitle = `${BRAND.name} — ${BRAND.shortTagline}`

export const metadata: Metadata = {
  title: homeTitle,
  description: BRAND.description,
  keywords: [
    BRAND.name,
    "Bold Stories",
    "Proven Impact",
    "brand campaigns",
    "event production",
    "creative media agency",
    "brand storytelling",
    "video production",
    "web development",
    "programmatic advertising",
    "OTT and CTV",
    "San Antonio marketing agency",
    "South Texas",
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
