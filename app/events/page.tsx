import type { Metadata } from "next"
import EventsClient from "./EventsClient"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"

export const metadata: Metadata = {
  title: "Events | Community Events & Networking in San Antonio",
  description:
    "Discover events hosted and curated by 434 MEDIA — networking meetups, tech days, startup demos, and community gatherings in San Antonio and South Texas.",
  keywords: [
    "San Antonio events",
    "networking events Texas",
    "tech meetups San Antonio",
    "startup events",
    "community events South Texas",
    "434 MEDIA events",
    "demo day San Antonio",
    "professional networking",
  ],
  alternates: {
    canonical: "/events",
  },
  openGraph: {
    title: "Events | 434 MEDIA — Community Events & Networking",
    description:
      "Networking meetups, tech days, startup demos, and community gatherings in San Antonio and South Texas.",
    url: `${siteUrl}/events`,
    siteName: "434 MEDIA",
    images: [
      {
        url: `${siteUrl}/api/og/page?page=events`,
        width: 1200,
        height: 630,
        alt: "434 MEDIA Events — Community Events & Networking in San Antonio",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Events | 434 MEDIA — Community Events & Networking",
    description:
      "Networking meetups, tech days, and community gatherings in San Antonio and South Texas.",
    images: [`${siteUrl}/api/og/page?page=events`],
    creator: "@434media",
    site: "@434media",
  },
}

export default function EventsPage() {
  return <EventsClient />
}
