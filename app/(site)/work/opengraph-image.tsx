import { renderCard, OG_SIZE } from "@/lib/og/card"

// This page's own share card, on the shared 434 card (lib/og/card.tsx). Until
// it existed, the page shared the generic site card.
export const runtime = "nodejs"
export const alt = "The work: original IP, platforms for brands and productions for brands, by 434 MEDIA"
export const size = OG_SIZE
export const contentType = "image/png"

export default function OpengraphImage() {
  return renderCard({
    headline: "The work.",
    description: "Original IP, platforms for brands and productions for brands.",
    path: "/work",
  })
}
