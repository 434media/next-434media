import type { Metadata } from "next"
import HomeClient from "./HomeClient"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"

export const metadata: Metadata = {
  title: "434 MEDIA | Creative Media and Smart Marketing Solutions in San Antonio, TX",
  description:
    "434 MEDIA connects enterprises in San Antonio and South Texas through ROI-driven brand media strategies — video production, web development, event production, and smart marketing that delivers measurable results.",
  keywords: [
    "434 MEDIA",
    "San Antonio marketing agency",
    "creative media San Antonio",
    "video production Texas",
    "brand storytelling",
    "event production San Antonio",
    "web development South Texas",
    "digital marketing agency",
    "ROI-driven marketing",
    "smart marketing solutions",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "434 MEDIA | Creative Media & Smart Marketing in San Antonio",
    description:
      "ROI-driven brand media strategies — video production, web development, event production — that move audiences and deliver measurable results.",
    url: siteUrl,
    siteName: "434 MEDIA",
    images: [
      {
        url: `${siteUrl}/api/og?title=434+MEDIA&subtitle=Creative+Media+%26+Smart+Marketing+Solutions`,
        width: 1200,
        height: 630,
        alt: "434 MEDIA — Creative Media & Smart Marketing Solutions in San Antonio, TX",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "434 MEDIA | Creative Media & Smart Marketing in San Antonio",
    description:
      "ROI-driven brand media strategies that move audiences and deliver measurable results.",
    images: [`${siteUrl}/api/og?title=434+MEDIA&subtitle=Creative+Media+%26+Smart+Marketing+Solutions`],
    creator: "@434media",
    site: "@434media",
  },
}

export default function HomePage() {
  return <HomeClient />
}
