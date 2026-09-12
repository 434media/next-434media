import type { Metadata } from "next"
import WorkClient from "./WorkClient"
import { buildServicesItemListLd } from "@/lib/seo/services"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"

export const metadata: Metadata = {
  title: "Our Work | Original IP, Platforms, and Productions",
  description:
    "434 MEDIA is a production studio that develops original IP and produces content, experiences, and platforms for brands. Selected work by commercial model.",
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
      "434 MEDIA is a production studio that develops original IP and produces content, experiences, and platforms for brands. Selected work by commercial model.",
    url: `${siteUrl}/work`,
    siteName: "434 MEDIA",
    images: [
      {
        url: `${siteUrl}/api/og/page?page=work`,
        width: 1200,
        height: 630,
        alt: "434 MEDIA — Production studio for original IP, content, experiences, and platforms.",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Our Work | 434 MEDIA",
    description:
      "434 MEDIA is a production studio that develops original IP and produces content, experiences, and platforms for brands. Selected work by commercial model.",
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
              "Selected 434 MEDIA work organized by commercial model: original IP, platforms for brands, and productions for brands.",
            isPartOf: { "@id": `${siteUrl}/#localbusiness` },
            about: { "@id": `${siteUrl}/#localbusiness` },
          }),
        }}
      />
      <WorkClient />
    </>
  )
}
