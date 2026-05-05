import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { BRAND } from "@/lib/seo/brand"

export const runtime = "nodejs"
export const alt = `${BRAND.name} — ${BRAND.shortTagline} ${BRAND.description}`
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function OpengraphImage() {
  // node fetch can't resolve file:// URLs from import.meta.url at prerender time.
  // Read the font from the project filesystem instead.
  const fontData = await readFile(path.join(process.cwd(), "fonts", "Menda-Black.otf"))

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "linear-gradient(135deg, #0891b2 0%, #0e7490 60%, #06414e 100%)",
        padding: 72,
        fontFamily: "Menda",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{
            width: 96,
            height: 96,
            background: "white",
            borderRadius: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 36,
            color: "#0e7490",
            fontWeight: 900,
            letterSpacing: -1,
          }}
        >
          434
        </div>
        <div
          style={{
            marginLeft: 24,
            color: "white",
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: 2,
          }}
        >
          434 MEDIA
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            color: "white",
            fontSize: 84,
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: -2,
          }}
        >
          Bold Stories.
        </div>
        <div
          style={{
            color: "rgba(255,255,255,0.92)",
            fontSize: 84,
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: -2,
          }}
        >
          Proven Impact.
        </div>
        <div
          style={{
            marginTop: 28,
            color: "rgba(255,255,255,0.85)",
            fontSize: 26,
            fontWeight: 400,
            lineHeight: 1.35,
            maxWidth: 1000,
          }}
        >
          {BRAND.description}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: "1px solid rgba(255,255,255,0.25)",
          paddingTop: 24,
        }}
      >
        <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 26, fontWeight: 700 }}>
          www.434media.com
        </div>
        <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 22, letterSpacing: 2 }}>
          {BRAND.location}
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: "Menda",
          data: fontData,
          style: "normal",
          weight: 700,
        },
      ],
    },
  )
}
