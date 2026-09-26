import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { TRAVEL_PROJECTS } from "@/lib/travel/projects"

/**
 * The link card for every /travel/<project> page.
 *
 * The site-wide card is a brand statement — the motto, the company definition,
 * the address. It is the right card for 434media.com and the wrong one here: a
 * travel link is sent to one named person about one trip, and it arrives in a
 * text thread or an inbox where the brand pitch reads as a mismatch.
 *
 * Three lines, fixed in that order: the company, what the link is, and which
 * project it belongs to. The first two never change, which is the point — this
 * is the card every itinerary gets, not one written per trip.
 *
 * The third line is the project slug, and it is **validated against the roster
 * before it is drawn**. This segment is dynamic, so without that check any URL
 * would render its own text onto a 434-branded image served from 434media.com,
 * which is a phishing asset with extra steps. An unknown slug renders nothing.
 *
 * The traveller is never named, and neither are dates. A link preview is
 * rendered by services the recipient does not control and is cached beyond the
 * page's own access rules, so the card says less than the page does.
 */

export const runtime = "nodejs"
export const alt = "Production travel itinerary — access required"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const fontPath = (file: string) => path.join(process.cwd(), "fonts", file)

export default async function TravelOpengraphImage({
  params,
}: {
  params: Promise<{ project: string }>
}) {
  const { project } = await params
  const known = Object.prototype.hasOwnProperty.call(TRAVEL_PROJECTS, project)
  const projectLine = known ? project : ""

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
        {projectLine ? (
          <div
            style={{
              fontFamily: "Geist",
              fontWeight: 600,
              fontSize: 32,
              color: "#8a8a92",
              marginTop: 26,
              letterSpacing: "0.01em",
            }}
          >
            {projectLine}
          </div>
        ) : null}
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
