import type { Metadata } from "next"
import { ContactPageClient } from "./ContactPageClient"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Take the next step with 434 MEDIA. We partner with venture capital firms, accelerators, startups, and industry leaders to create bold, strategic content that delivers results.",
  keywords: [
    "contact 434 MEDIA",
    "San Antonio marketing agency",
    "video production contact",
    "brand storytelling services",
    "ROI-driven media strategy",
    "event production quote",
  ],
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Contact 434 MEDIA | Get Started Today",
    description:
      "Ready to create bold, strategic content that delivers results? Contact 434 MEDIA for ROI-driven media strategies, brand storytelling, and video production services.",
    url: `${siteUrl}/contact`,
    images: [
      {
        url: `${siteUrl}/api/og/page?page=contact`,
        width: 1200,
        height: 630,
        alt: "Contact 434 MEDIA — Get Started Today",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact 434 MEDIA | Get Started Today",
    description:
      "Ready to create bold, strategic content that delivers results? Contact 434 MEDIA for ROI-driven media strategies, brand storytelling, and video production services.",
    images: [`${siteUrl}/api/og/page?page=contact`],
    creator: "@434media",
    site: "@434media",
  },
}

export default function ContactPage() {
  return <ContactPageClient />
}
