import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Lunch and Learn Feedback | Lead with Ops. Layer in AI.",
  description:
    "Ninety seconds of feedback on the Lead with Ops. Layer in AI. executive working lunch with Adam Carroll. It shapes the next session — and tells us who'd like to keep the conversation going.",
  alternates: { canonical: "/workshops/lead-with-ops/feedback" },
  // A post-event intake form, linked from the attendee email: not meant to be
  // found in search or shared as a card. Noindex, as it was on Digital Canvas.
  robots: { index: false, follow: false },
}

export default function LeadWithOpsFeedbackLayout({ children }: { children: React.ReactNode }) {
  return children
}
