import type React from "react"
import type { Metadata } from "next"

const flyerUrl =
  "https://firebasestorage.googleapis.com/v0/b/groovy-ego-462522-v2.firebasestorage.app/o/digitalcanvas%2FInvitation%20only%20Limited%20Executive%20Seating.PNG?alt=media"

const description =
  "An executive working lunch with Adam Carroll of Carroll Strategy & Operations on leading with operations and layering in AI. June 18, 2026, at VelocityTX."

export const metadata: Metadata = {
  title: "Lead with Ops. Layer in AI. | June 18, 2026",
  description,
  alternates: { canonical: "/workshops/lead-with-ops" },
  openGraph: {
    title: "Lead with Ops. Layer in AI. | Executive Working Lunch",
    description:
      "Executive working lunch with Adam Carroll. AI strategy, operational alignment, and implementation. VelocityTX, June 18, 2026.",
    url: "/workshops/lead-with-ops",
    type: "website",
    images: [
      {
        url: flyerUrl,
        width: 1200,
        height: 1500,
        alt: "Lead with Ops. Layer in AI. — Executive Working Lunch, June 18, 2026, VelocityTX",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lead with Ops. Layer in AI. | Executive Working Lunch",
    description: "Executive working lunch with Adam Carroll. VelocityTX, June 18, 2026.",
    images: [flyerUrl],
    creator: "@434media",
    site: "@434media",
  },
}

export default function LeadWithOpsLayout({ children }: { children: React.ReactNode }) {
  return children
}
