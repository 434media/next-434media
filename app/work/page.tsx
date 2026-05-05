import type { Metadata } from "next"
import WorkClient from "./WorkClient"
import { buildServicesItemListLd } from "@/lib/seo/services"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"

export const metadata: Metadata = {
  title: "Our Work | Bold Stories. Proven Impact.",
  description:
    "From brand campaigns, to event production, we help the world's most innovative firms find their voice and amplify their impact through bold storytelling and experiences.",
  keywords: [
    "434 MEDIA portfolio",
    "bold stories",
    "proven impact",
    "creative agency work",
    "brand storytelling examples",
    "event production portfolio",
    "San Antonio creative agency",
    "video production work",
    "startup marketing examples",
  ],
  alternates: {
    canonical: "/work",
  },
  openGraph: {
    title: "Our Work | 434 MEDIA — Bold Stories. Proven Impact.",
    description:
      "From brand campaigns, to event production, we help the world's most innovative firms find their voice and amplify their impact through bold storytelling and experiences.",
    url: `${siteUrl}/work`,
    siteName: "434 MEDIA",
    images: [
      {
        url: `${siteUrl}/api/og/page?page=work`,
        width: 1200,
        height: 630,
        alt: "434 MEDIA — Bold Stories. Proven Impact.",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Our Work | 434 MEDIA — Bold Stories. Proven Impact.",
    description:
      "From brand campaigns, to event production, we help the world's most innovative firms find their voice and amplify their impact through bold storytelling and experiences.",
    images: [`${siteUrl}/api/og/page?page=work`],
    creator: "@434media",
    site: "@434media",
  },
}

export default function WorkPage() {
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
              "Selected portfolio of brand storytelling, video, event production, and integrated campaign work by 434 MEDIA.",
            isPartOf: { "@id": `${siteUrl}/#localbusiness` },
            about: { "@id": `${siteUrl}/#localbusiness` },
          }),
        }}
      />
      <WorkClient />
    </>
  )
}
