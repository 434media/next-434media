import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { BRAND } from "@/lib/seo/brand"

export const runtime = "nodejs"
export const alt = `${BRAND.name} — ${BRAND.shortTagline} ${BRAND.description}`
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const fontPath = (file: string) => path.join(process.cwd(), "fonts", file)

export default async function OpengraphImage() {
  // Load REAL static weight files (not a variable-font master) so Satori
  // can match each weight without synthesizing boldness — synthetic bold
  // is what causes blurry, smeared edges in OG renders.
  const [mendaBlack, geist400, geist600, geist800] = await Promise.all([
    readFile(fontPath("Menda-Black.otf")),
    readFile(fontPath("Geist-Regular.otf")),
    readFile(fontPath("Geist-SemiBold.otf")),
    readFile(fontPath("Geist-ExtraBold.otf")),
  ])

  return new ImageResponse(
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
      {/* Subtle dot grid for texture (matches the page hero) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.06,
          backgroundImage:
            "radial-gradient(circle, #0a0a0a 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          display: "flex",
        }}
      />

      {/* Top: 434 MEDIA wordmark */}
      <div style={{ display: "flex", alignItems: "center", zIndex: 1 }}>
        <div
          style={{
            color: "#0a0a0a",
            fontSize: 30,
            fontFamily: "Menda",
            fontWeight: 700,
            letterSpacing: 2,
          }}
        >
          434 MEDIA
        </div>
      </div>

      {/* Middle: headline + description */}
      <div style={{ display: "flex", flexDirection: "column", zIndex: 1 }}>
        <div
          style={{
            color: "#0a0a0a",
            fontSize: 96,
            fontWeight: 800,
            lineHeight: 1.0,
            letterSpacing: -3,
          }}
        >
          {BRAND.headline}
        </div>
        <div
          style={{
            color: "#737373",
            fontSize: 96,
            fontWeight: 800,
            lineHeight: 1.0,
            letterSpacing: -3,
          }}
        >
          {BRAND.headline2}
        </div>
        <div
          style={{
            marginTop: 32,
            color: "#525252",
            fontSize: 26,
            fontWeight: 400,
            lineHeight: 1.4,
            maxWidth: 980,
          }}
        >
          {BRAND.description}
        </div>
      </div>

      {/* Footer: domain + location */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: "1px solid #e5e5e5",
          paddingTop: 24,
          zIndex: 1,
        }}
      >
        <div style={{ color: "#404040", fontSize: 22, fontWeight: 600 }}>
          {BRAND.domain}
        </div>
        <div style={{ color: "#737373", fontSize: 18, fontWeight: 600, letterSpacing: 3 }}>
          {BRAND.location}
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Menda", data: mendaBlack, style: "normal", weight: 700 },
        { name: "Geist", data: geist400, style: "normal", weight: 400 },
        { name: "Geist", data: geist600, style: "normal", weight: 600 },
        { name: "Geist", data: geist800, style: "normal", weight: 800 },
      ],
    },
  )
}
