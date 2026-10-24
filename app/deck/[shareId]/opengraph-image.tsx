import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { getDeckByShareId } from "@/lib/firestore-deck"
import { fitTitleSize } from "@/lib/og/fit-title"

export const runtime = "nodejs"
export const alt = "434 Media sales deck"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const fontPath = (file: string) => path.join(process.cwd(), "fonts", file)

/** Smallest the deck name is set: 60 characters of Menda's widest letters (W, M) fit in three lines at 36px. */
const TITLE_MIN_SIZE = 36

export default async function DeckOgImage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params
  const deck = await getDeckByShareId(shareId).catch(() => null)
  const title = deck && deck.status === "published" ? deck.name : "Sales Deck"

  const [menda, geist400] = await Promise.all([
    readFile(fontPath("Menda-Black.otf")),
    readFile(fontPath("Geist-Regular.otf")),
  ])

  // Menda is wide: at a fixed 84px a 60-character name ran to six lines and
  // into the footer. Size it so the whole name fits in three lines instead.
  const displayTitle = title.length > 60 ? `${title.slice(0, 60)}…` : title
  const titleSize = fitTitleSize(menda, displayTitle.toUpperCase(), {
    maxSize: 84, minSize: TITLE_MIN_SIZE, maxWidth: 1200 - 72 * 2, maxLines: 3, letterSpacing: -2,
  })

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
              fontSize: titleSize,
              fontFamily: "Menda",
              textTransform: "uppercase",
              letterSpacing: -2,
              lineHeight: 1,
              // Only a single word wider than the image reaches this.
              wordBreak: "break-word",
              display: "flex",
            }}
          >
            {displayTitle}
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
        { name: "Menda", data: menda, style: "normal", weight: 700 },
        { name: "Geist", data: geist400, style: "normal", weight: 400 },
      ],
    },
  )
}
