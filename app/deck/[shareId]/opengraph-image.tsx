import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { getDeckByShareId } from "@/lib/firestore-deck"

export const runtime = "nodejs"
export const alt = "434 Media sales deck"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const fontPath = (file: string) => path.join(process.cwd(), "fonts", file)

export default async function DeckOgImage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params
  const deck = await getDeckByShareId(shareId).catch(() => null)
  const title = deck && deck.status === "published" ? deck.name : "Sales Deck"

  const [ggx88, menda, geist400] = await Promise.all([
    readFile(fontPath("GGX88.otf")),
    readFile(fontPath("Menda-Black.otf")),
    readFile(fontPath("Geist-Regular.otf")),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          padding: 72,
          fontFamily: "Geist",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.06,
            backgroundImage: "radial-gradient(circle, #0a0a0a 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            display: "flex",
          }}
        />

        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", zIndex: 1 }}>
          <div style={{ color: "#0a0a0a", fontSize: 30, fontFamily: "Menda", letterSpacing: 2 }}>
            434 MEDIA
          </div>
        </div>

        {/* Deck title */}
        <div style={{ display: "flex", flexDirection: "column", zIndex: 1 }}>
          <div
            style={{
              color: "#171717",
              fontSize: 84,
              fontFamily: "GGX88",
              textTransform: "uppercase",
              letterSpacing: -2,
              lineHeight: 1,
              display: "flex",
            }}
          >
            {title.length > 60 ? `${title.slice(0, 60)}…` : title}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", zIndex: 1 }}>
          <div style={{ color: "#737373", fontSize: 24, letterSpacing: 4, textTransform: "uppercase" }}>
            Sales Deck
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "GGX88", data: ggx88, style: "normal", weight: 800 },
        { name: "Menda", data: menda, style: "normal", weight: 700 },
        { name: "Geist", data: geist400, style: "normal", weight: 400 },
      ],
    },
  )
}
