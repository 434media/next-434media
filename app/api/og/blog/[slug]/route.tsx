import type { NextRequest } from "next/server"
import { renderCard } from "@/lib/og/card"

export const runtime = "nodejs"

// A blog post's card, on the shared 434 card: the category, the title, and the
// author and date in the footer. It was the indigo-violet gradient (3.8).
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const { searchParams } = new URL(req.url)
    const author = (searchParams.get("author") || "434 MEDIA").trim()
    const date = searchParams.get("date")?.trim()
    return await renderCard({
      kicker: searchParams.get("category") || "Blog",
      headline: searchParams.get("title") || "434 MEDIA Blog",
      path: `/blog/${slug}`,
      footerRight: (date ? `${author} · ${date}` : author).toUpperCase(),
    })
  } catch (e) {
    console.error("OG image generation failed:", e)
    return new Response("Failed to generate the image", { status: 500 })
  }
}
