import { ImageResponse } from "next/og"
import type { NextRequest } from "next/server"

// Route segment config
export const runtime = "edge"

// Image metadata
export const alt = "434 MEDIA"
export const size = {
  width: 1200,
  height: 630,
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    // Get dynamic params
    const title = searchParams.get("title") || "434 MEDIA"
    const subtitle = searchParams.get("subtitle") || "Creative Media and Smart Marketing Solutions"
    const locale = searchParams.get("locale") || "en"
    const path = searchParams.get("path") || ""

    // Font
    const fontData = await fetch(new URL("../../fonts/Menda-Black.otf", import.meta.url)).then((res) =>
      res.arrayBuffer(),
    )

    return new ImageResponse(
      <div
        style={{
          fontSize: 48,
          background: "linear-gradient(to bottom right, #0891b2, #0e7490)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 48,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
          }}
        >
          {/* Logo placeholder - replace with your actual logo */}
          <div
            style={{
              width: 120,
              height: 120,
              background: "white",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 24,
              fontSize: 32,
              fontWeight: "bold",
            }}
          >
            434
          </div>
          <div
            style={{
              fontSize: 32,
              color: "white",
              fontWeight: "bold",
            }}
          >
            434 MEDIA
          </div>
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: "bold",
            color: "white",
            marginBottom: 24,
            textAlign: "center",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 36,
            color: "rgba(255, 255, 255, 0.9)",
            textAlign: "center",
          }}
        >
          {subtitle}
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "calc(100% - 96px)",
            borderTop: "1px solid rgba(255, 255, 255, 0.2)",
            paddingTop: 24,
          }}
        >
          <div
            style={{
              color: "rgba(255, 255, 255, 0.8)",
              fontSize: 24,
            }}
          >
            www.434media.com/{path ? `${locale}/${path}` : ""}
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
