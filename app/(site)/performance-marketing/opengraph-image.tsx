import { renderCard, OG_SIZE } from "@/lib/og/card"

// This page's own share card, on the shared 434 card (lib/og/card.tsx). Until
// it existed, the page shared the generic site card.
export const runtime = "nodejs"
export const alt = "Demand Drives Performance, from 434 MEDIA"
export const size = OG_SIZE
export const contentType = "image/png"

export default function OpengraphImage() {
  return renderCard({
    headline: "Demand Drives Performance.",
    description: "How demand creation, demand capture and measurement work as one system.",
    path: "/performance-marketing",
  })
}
