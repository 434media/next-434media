import type { Metadata } from "next"
import ShopClient from "./ShopClient"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"

export const metadata: Metadata = {
  title: "TXMX Boxing | Shop Premium Boxing Merchandise",
  description:
    "Shop the TXMX Boxing collection — premium boxing-inspired apparel and merchandise rooted in Texas-Mexico culture. Founder's tees, fight gear, and limited drops from 434 MEDIA.",
  keywords: [
    "TXMX Boxing",
    "boxing merchandise",
    "boxing apparel",
    "Texas boxing",
    "TXMX clothing",
    "boxing t-shirts",
    "fight gear",
    "434 MEDIA shop",
  ],
  alternates: {
    canonical: "/shop",
  },
  openGraph: {
    title: "TXMX Boxing | Premium Boxing Merchandise",
    description:
      "Premium boxing-inspired apparel rooted in Texas-Mexico culture. Shop founder's tees, fight gear, and limited drops.",
    url: `${siteUrl}/shop`,
    siteName: "434 MEDIA",
    images: [
      {
        url: `${siteUrl}/api/og/page?page=shop`,
        width: 1200,
        height: 630,
        alt: "TXMX Boxing — Premium Boxing Merchandise",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TXMX Boxing | Premium Boxing Merchandise",
    description:
      "Premium boxing-inspired apparel rooted in Texas-Mexico culture. Shop founder's tees and limited drops.",
    images: [`${siteUrl}/api/og/page?page=shop`],
    creator: "@434media",
    site: "@434media",
  },
}

export default function ShopPage() {
  return <ShopClient />
}
