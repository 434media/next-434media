import type { Metadata } from "next"
import { ContactPageClient } from "./ContactPageClient"
import { BRAND } from "@/lib/seo/brand"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"

// Master 9.5 (Start a production), 9.7 (metadata) and 1.1 (the definition,
// read from the generated extract rather than restated).
const description = `${BRAND.description} Tell us what you want to produce.`
const socialTitle = `Start a production | ${BRAND.name}`

export const metadata: Metadata = {
  title: "Start a production",
  description,
  keywords: [
    "contact 434 MEDIA",
    "start a production",
    "production studio",
    "production company",
    "original IP",
    "brand studio",
    "live-event production",
    "documentary production",
    "San Antonio production studio",
  ],
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: socialTitle,
    description,
    url: `${siteUrl}/contact`,
    // The image is this segment's own opengraph-image.tsx, which Next wires in
    // with a hashed URL (/<route>/opengraph-image-<hash>), so it is not named
    // here. A colocated card is not suppressed by this `openGraph` object; the
    // suppression 3.8 records is of a card inherited from a parent segment.
  },
  twitter: {
    card: "summary_large_image",
    title: socialTitle,
    description,
    // Likewise twitter-image.tsx in this segment.
    creator: "@434media",
    site: "@434media",
  },
}

export default function ContactPage() {
  return <ContactPageClient />
}
