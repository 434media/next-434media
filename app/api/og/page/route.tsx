import { ImageResponse } from "next/og"
import type { NextRequest } from "next/server"

export const runtime = "edge"

const size = {
  width: 1200,
  height: 630,
}

const pageConfig: Record<
  string,
  {
    title: string
    subtitle: string
    accent: string
    gradient: string
    icon: string
  }
> = {
  shop: {
    title: "TXMX BOXING",
    subtitle: "Premium Boxing Merchandise — San Antonio",
    accent: "#ffffff",
    gradient: "linear-gradient(135deg, #000000, #1a1a1a, #000000)",
    icon: "🥊",
  },
  events: {
    title: "EVENTS",
    subtitle: "Community Events & Networking — San Antonio",
    accent: "#00e5ff",
    gradient: "linear-gradient(135deg, #0a0a0a, #111827, #0a0a0a)",
    icon: "📅",
  },
  work: {
    title: "OUR WORK",
    subtitle: "Bold, Strategic Creative — Proven Impact",
    accent: "#f97316",
    gradient: "linear-gradient(135deg, #0c0a09, #1c1917, #0c0a09)",
    icon: "🎬",
  },
  contact: {
    title: "CONTACT US",
    subtitle: "Let's Build Something Together",
    accent: "#22d3ee",
    gradient: "linear-gradient(135deg, #0891b2, #0e7490, #155e75)",
    icon: "✉️",
  },
  blog: {
    title: "BLOG",
    subtitle: "Insights, Stories & Industry Perspectives",
    accent: "#a78bfa",
    gradient: "linear-gradient(135deg, #1e1b4b, #312e81, #1e1b4b)",
    icon: "📝",
  },
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = searchParams.get("page") || "shop"

    const config = pageConfig[page] || pageConfig.shop

    const fontData = await fetch(
      new URL("../../../../fonts/Menda-Black.otf", import.meta.url)
    ).then((res) => res.arrayBuffer())

    return new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: config.gradient,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background pattern — diagonal lines */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.06,
            display: "flex",
            backgroundImage:
              "repeating-linear-gradient(45deg, white 0px, white 1px, transparent 1px, transparent 40px)",
          }}
        />

        {/* Top accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: config.accent,
            display: "flex",
          }}
        />

        {/* 434 logo + branding */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            position: "absolute",
            top: 40,
            left: 48,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              background: "white",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 900,
              color: "#000",
              marginRight: 16,
            }}
          >
            434
          </div>
          <div
            style={{
              fontSize: 22,
              color: "rgba(255,255,255,0.7)",
              fontWeight: 700,
              letterSpacing: 2,
            }}
          >
            434 MEDIA
          </div>
        </div>

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "0 64px",
            marginTop: 24,
          }}
        >
          {/* Icon */}
          <div
            style={{
              fontSize: 56,
              marginBottom: 20,
              display: "flex",
            }}
          >
            {config.icon}
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: "white",
              lineHeight: 1,
              letterSpacing: -1,
              marginBottom: 20,
              fontFamily: "Menda",
              display: "flex",
            }}
          >
            {config.title}
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: 28,
              color: "rgba(255,255,255,0.75)",
              lineHeight: 1.4,
              maxWidth: 700,
              display: "flex",
            }}
          >
            {config.subtitle}
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "calc(100% - 96px)",
            borderTop: "1px solid rgba(255,255,255,0.15)",
            paddingTop: 20,
          }}
        >
          <div
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 20,
              display: "flex",
            }}
          >
            www.434media.com/{page}
          </div>
          <div
            style={{
              color: config.accent,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: 3,
              display: "flex",
            }}
          >
            SAN ANTONIO, TX
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
            weight: 900,
          },
        ],
      }
    )
  } catch (e) {
    console.error(e)
    return new Response("Failed to generate image", { status: 500 })
  }
}
