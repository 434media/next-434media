import { renderCard, OG_SIZE } from "@/lib/og/card"
import { BRAND } from "@/lib/seo/brand"
import { BRAND_RECORDS } from "@/lib/brand-records"

// The site card: the styled motto, drawn into the image (1.4), over the 1.1
// definition. Its alt is the plain form. The layout is lib/og/card.tsx, shared
// by every 434 card (Display and Design Standard 3.8).
export const runtime = "nodejs"
export const alt = BRAND_RECORDS.mottoPlain
export const size = OG_SIZE
export const contentType = "image/png"

export default function OpengraphImage() {
  return renderCard({ headline: BRAND_RECORDS.mottoStyled, description: BRAND.description })
}
