import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"

// Share card for /thefeed. Moved from the Digital Canvas site in 2026-10; the
// logo it drew from an external bucket is set as type instead.
const pixel = await readFile(join(process.cwd(), "public/fonts/GeistPixel-Square.ttf"))

export async function GET() {
  const pixelText = { fontFamily: "GeistPixel", textTransform: "uppercase" as const }

  return new ImageResponse(
    (
      <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", backgroundColor: "#0a0a0a", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "4px", background: "linear-gradient(to right, #FF006E, #88FF00)" }} />

        <div style={{ display: "flex", padding: "56px 80px 0", fontSize: "28px", letterSpacing: "0.08em", color: "#ffffff", ...pixelText }}>
          Digital Canvas
        </div>

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "32px 80px 0", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
            <div style={{ width: "8px", height: "8px", backgroundColor: "#FF006E", borderRadius: "50%" }} />
            <div style={{ fontSize: "18px", letterSpacing: "0.35em", color: "#FF006E", ...pixelText }}>Field Notes</div>
          </div>
          <div style={{ fontSize: "84px", color: "#ffffff", lineHeight: 1.05, letterSpacing: "0.02em", marginBottom: "32px", ...pixelText }}>
            The Feed
          </div>
          <div style={{ fontSize: "20px", color: "rgba(255,255,255,0.5)", lineHeight: 1.65, maxWidth: "780px", marginBottom: "36px", fontFamily: "monospace" }}>
            Field notes from the work — cohort builds, demo days, workshops, and the San Antonio builder ecosystem.
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            {[
              { label: "Articles", color: "#88FF00" },
              { label: "Videos", color: "#FF006E" },
              { label: "Newsletters", color: "#fbbf24" },
            ].map((type) => (
              <div
                key={type.label}
                style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", letterSpacing: "0.22em", color: type.color, border: `1px solid ${type.color}40`, padding: "8px 16px", ...pixelText }}
              >
                <div style={{ width: "6px", height: "6px", backgroundColor: type.color, borderRadius: "50%" }} />
                {type.label}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 80px", borderTop: "1px solid #222", fontSize: "13px", letterSpacing: "0.25em", color: "rgba(255,255,255,0.3)", ...pixelText }}>
          <div>434media.com/thefeed</div>
          <div>San Antonio · Builder Program</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [{ name: "GeistPixel", data: pixel, style: "normal", weight: 400 }],
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    },
  )
}
