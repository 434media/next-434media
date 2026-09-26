import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import path from "node:path"

/**
 * The link card for every /travel page.
 *
 * The site-wide card is a brand statement — the motto, the company definition,
 * the address. It is the right card for 434media.com and the wrong one here: a
 * travel link is sent to one named person about one trip, and it arrives in a
 * text thread or an inbox where the brand pitch reads as a mismatch.
 *
 * This is deliberately one line. It says what the link is and nothing else. No
 * client, no traveller, no dates — a link preview is rendered by services the
 * recipient does not control and is often cached beyond the page's own access
 * rules, so the card says less than the page does on purpose.
 */

export const runtime = "nodejs"
export const alt = "Production travel itinerary — access required"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const fontPath = (file: string) => path.join(process.cwd(), "fonts", file)

export default async function TravelOpengraphImage() {
  const [geist600, geist800] = await Promise.all([
    readFile(fontPath("Geist-SemiBold.otf")),
    readFile(fontPath("Geist-ExtraBold.otf")),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "0 96px",
          backgroundColor: "#0a0a0b",
          color: "#ffffff",
        }}
      >
        <div
          style={{
            fontFamily: "Geist",
            fontWeight: 600,
            fontSize: 26,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#8a8a92",
            marginBottom: 28,
          }}
        >
          434 MEDIA
        </div>
        <div
          style={{
            fontFamily: "Geist",
            fontWeight: 800,
            fontSize: 68,
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            maxWidth: 900,
          }}
        >
          Production travel itinerary
        </div>
        <div
          style={{
            fontFamily: "Geist",
            fontWeight: 600,
            fontSize: 30,
            color: "#8a8a92",
            marginTop: 26,
          }}
        >
          Access required
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: geist600, weight: 600, style: "normal" },
        { name: "Geist", data: geist800, weight: 800, style: "normal" },
      ],
    },
  )
}
