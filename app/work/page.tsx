import type { Metadata } from "next"
import WorkClient from "./WorkClient"
import { getWorkPageRecords } from "@/lib/sor/work-page-data"
import { buildServicesItemListLd } from "@/lib/seo/services"
import { BRAND_RECORDS } from "@/lib/brand-records"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"

export const metadata: Metadata = {
  title: "Our Work | Original IP, Platforms, and Productions",
  description:
    `${BRAND_RECORDS.canonicalDefinition} Selected work by commercial model.`,
  keywords: [
    "434 MEDIA portfolio",
    "production studio",
    "original IP",
    "platforms for brands",
    "productions for brands",
    "event production portfolio",
    "San Antonio production studio",
    "conference production",
    "brand film production",
  ],
  alternates: {
    canonical: "/work",
  },
  openGraph: {
    title: "Our Work | 434 MEDIA",
    description:
      `${BRAND_RECORDS.canonicalDefinition} Selected work by commercial model.`,
    url: `${siteUrl}/work`,
    siteName: "434 MEDIA",
    // The site-level card from app/opengraph-image.tsx — the wordmark, the
    // motto in its styled form, and the canonical definition. Named explicitly
    // rather than omitted: declaring an `openGraph` object without `images`
    // suppresses the file-based image instead of inheriting it, and /work then
    // resolves with no og:image at all. Verified in the rendered head.
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: BRAND_RECORDS.mottoPlain,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Our Work | 434 MEDIA",
    description:
      `${BRAND_RECORDS.canonicalDefinition} Selected work by commercial model.`,
    // Same reasoning: the site-level card, named explicitly.
    images: [`${siteUrl}/twitter-image`],
    creator: "@434media",
    site: "@434media",
  },
}

/**
 * Records come from the `portfolio_records` collection rather than from the
 * generated extract, and are revalidated hourly. They change when the master
 * changes, which is rarely and never urgently, so an hour of staleness costs
 * nothing and a Firestore read on every request would.
 *
 * `getWorkPageRecords` falls back to the generated extract if the store cannot
 * be reached, so this page cannot be emptied by an infrastructure fault.
 */
export const revalidate = 3600

export default async function WorkPage() {
  const { records } = await getWorkPageRecords()

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildServicesItemListLd(siteUrl, `${siteUrl}/work`)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Our Work | 434 MEDIA",
            url: `${siteUrl}/work`,
            description:
              "Selected 434 MEDIA work organized by commercial model: original IP, platforms for brands, and productions for brands.",
            isPartOf: { "@id": `${siteUrl}/#localbusiness` },
            about: { "@id": `${siteUrl}/#localbusiness` },
          }),
        }}
      />
      <WorkClient records={records} />
    </>
  )
}
