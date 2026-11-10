import { renderCard, OG_SIZE } from "@/lib/og/card"
import { BRAND } from "@/lib/seo/brand"

// This page's own share card, on the shared 434 card (lib/og/card.tsx). Until
// it existed, the page shared the generic site card.
export const runtime = "nodejs"
export const alt = "Start a production with 434 MEDIA"
export const size = OG_SIZE
export const contentType = "image/png"

export default function OpengraphImage() {
  return renderCard({
    headline: "Start a production.",
    description: BRAND.description,
    path: "/contact",
  })
}
