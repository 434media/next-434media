import { ImageResponse } from "next/og"
import type { NextRequest } from "next/server"
import { BRAND } from "@/lib/seo/brand"

export const runtime = "nodejs"

export const alt = `${BRAND.name} — ${BRAND.shortTagline}`
export const size = {
  width: 1200,
  height: 630,
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    // Per-page customization. When no title is provided we fall back to the
    // canonical brand headline so the image still feels on-brand.
    const title = searchParams.get("title") || BRAND.headline
    const subtitle = searchParams.get("subtitle") || BRAND.headline2
    const path = searchParams.get("path") || ""
    const locale = searchParams.get("locale") || "en"

    const fontData = await fetch(new URL("../../../fonts/Menda-Black.otf", import.meta.url)).then(
      (res) => res.arrayBuffer(),
    )

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
        {/* Brand mark */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: 80,
              height: 80,
              background: "white",
              borderRadius: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              color: "#0e7490",
              fontWeight: 900,
              letterSpacing: -1,
            }}
          >
            434
          </div>
          <div
            style={{
              marginLeft: 20,
              color: "white",
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: 2,
            }}
          >
            {BRAND.name}
          </div>
        </div>

        {/* Page-specific headline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              color: "white",
              fontSize: 80,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 1050,
            }}
          >
            {title}
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.92)",
              fontSize: 80,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 1050,
            }}
          >
            {subtitle}
          </div>
          <div
            style={{
              marginTop: 24,
              color: "rgba(255,255,255,0.85)",
              fontSize: 24,
              fontWeight: 400,
              lineHeight: 1.35,
              maxWidth: 1000,
            }}
          >
            {BRAND.description}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(255,255,255,0.25)",
            paddingTop: 22,
          }}
        >
          <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 22, fontWeight: 700 }}>
            {BRAND.domain}
            {path ? `/${locale === "en" ? "" : `${locale}/`}${path}` : ""}
          </div>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 20, letterSpacing: 2 }}>
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
  } catch (e) {
    console.error(e)
    return new Response(`Failed to generate image`, {
      status: 500,
    })
  }
}
