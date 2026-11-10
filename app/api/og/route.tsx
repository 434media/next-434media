import type { NextRequest } from "next/server"
import { renderCard } from "@/lib/og/card"
import { BRAND } from "@/lib/seo/brand"
import { BRAND_RECORDS } from "@/lib/brand-records"

export const runtime = "nodejs"

/**
 * The per-page card: ?title=, ?subtitle= and ?path=. With no title it is the
 * site card. It used to be a cyan gradient (#0891b2 → #06414e) with a typed
 * "434" tile and the name set in Menda; it is now the shared 434 card
 * (lib/og/card.tsx). `locale` is accepted and ignored: the card carries no
 * localized chrome.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const title = searchParams.get("title")
    return await renderCard({
      headline: title || BRAND_RECORDS.mottoStyled,
      description: title ? searchParams.get("subtitle") || undefined : BRAND.description,
      path: searchParams.get("path") || undefined,
    })
  } catch (e) {
    console.error("OG image generation failed:", e)
    return new Response("Failed to generate the image", { status: 500 })
  }
}
