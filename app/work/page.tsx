import type { Metadata } from "next"
import WorkClient from "./WorkClient"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"

export const metadata: Metadata = {
  title: "Our Work | Bold Creative Portfolio",
  description:
    "Explore the bold, strategic work by 434 MEDIA. From brand storytelling to event production, see how we deliver proven impact for VCs, accelerators, and startups.",
  keywords: [
    "434 MEDIA portfolio",
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
    title: "Our Work | 434 MEDIA — Bold Creative Portfolio",
    description:
      "Explore the bold, strategic work by 434 MEDIA. From brand storytelling to event production, see how we deliver proven impact.",
    url: `${siteUrl}/work`,
    siteName: "434 MEDIA",
    images: [
      {
        url: `${siteUrl}/api/og/page?page=work`,
        width: 1200,
        height: 630,
        alt: "434 MEDIA — Our Work & Creative Portfolio",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Our Work | 434 MEDIA — Bold Creative Portfolio",
    description:
      "From brand storytelling to event production — see how we deliver proven impact for VCs, accelerators, and startups.",
    images: [`${siteUrl}/api/og/page?page=work`],
    creator: "@434media",
    site: "@434media",
  },
}

export default function WorkPage() {
  return <WorkClient />
}
