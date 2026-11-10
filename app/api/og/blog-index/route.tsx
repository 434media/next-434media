import { renderCard } from "@/lib/og/card"

export const runtime = "nodejs"

// The blog index card, on the shared 434 card. It was an indigo-violet
// gradient with a typed "434" tile, off the palette (3.8).
export async function GET() {
  try {
    return await renderCard({
      kicker: "Blog",
      headline: "News and stories from the studio",
      path: "/blog",
    })
  } catch (e) {
    console.error("OG image generation failed:", e)
    return new Response("Failed to generate the image", { status: 500 })
  }
}
