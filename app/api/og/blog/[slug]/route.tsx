import { ImageResponse } from "next/og"
import type { NextRequest } from "next/server"

export const runtime = "edge"

// Add proper font loading
async function loadGoogleFont(font: string, text: string) {
  const url = `https://fonts.googleapis.com/css2?family=${font}:wght@400;600;700&display=swap`
  const css = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1",
    },
  }).then((res) => res.text())

  const resource = css.match(/src: url$$(.+)$$ format$$'(opentype|truetype)'$$/)

  if (resource) {
    const response = await fetch(resource[1])
    if (response.status == 200) {
      return await response.arrayBuffer()
    }
  }

  return null
}

export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
  const { slug } = params
    const { searchParams } = new URL(request.url)

    // Get parameters with proper defaults
    const title = searchParams.get("title") || "434 Media Blog"
    const category = searchParams.get("category") || "Technology"
    const author = searchParams.get("author") || "434 Media"
    const date = searchParams.get("date") || new Date().toLocaleDateString()

    // Load custom font for better typography
    const fontData = await loadGoogleFont("Inter", title)

    return new ImageResponse(
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          backgroundColor: "#0a0a0a",
          backgroundImage: `
            radial-gradient(circle at 25% 25%, #6366f1 0%, transparent 50%),
            radial-gradient(circle at 75% 75%, #8b5cf6 0%, transparent 50%),
            linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)
          `,
          padding: "60px",
          fontFamily: fontData ? "Inter" : "system-ui",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Animated background elements */}
        <div
          style={{
            position: "absolute",
            top: "-50%",
            left: "-50%",
            width: "200%",
            height: "200%",
            background: `
              radial-gradient(circle, rgba(99, 102, 241, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: "50px 50px",
            transform: "rotate(15deg)",
          }}
        />

        {/* Header with logo and category */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            width: "100%",
            zIndex: 10,
          }}
        >
          {/* Logo */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <div
              style={{
                width: "60px",
                height: "60px",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                borderRadius: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
                fontWeight: "700",
                color: "white",
                boxShadow: "0 8px 32px rgba(99, 102, 241, 0.3)",
              }}
            >
              434
            </div>
            <div
              style={{
                fontSize: "28px",
                fontWeight: "700",
                color: "white",
                letterSpacing: "-0.02em",
              }}
            >
              434 MEDIA
            </div>
          </div>

          {/* Category badge */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              borderRadius: "24px",
              padding: "12px 24px",
              fontSize: "16px",
              fontWeight: "600",
              color: "#a5b4fc",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              backdropFilter: "blur(10px)",
            }}
          >
            {category}
          </div>
        </div>

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
            width: "100%",
            maxWidth: "900px",
            zIndex: 10,
          }}
        >
          {/* Title */}
          <h1
            style={{
              fontSize: title.length > 50 ? "48px" : "64px",
              fontWeight: "700",
              color: "white",
              lineHeight: "1.1",
              margin: "0 0 24px 0",
              letterSpacing: "-0.02em",
              textShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
            }}
          >
            {title}
          </h1>

          {/* Gradient line */}
          <div
            style={{
              width: "120px",
              height: "4px",
              background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
              borderRadius: "2px",
              marginBottom: "32px",
            }}
          />
        </div>

        {/* Footer with author and date */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            zIndex: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              color: "#94a3b8",
              fontSize: "18px",
              fontWeight: "500",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "16px",
                fontWeight: "600",
                color: "white",
              }}
            >
              {author.charAt(0).toUpperCase()}
            </div>
            <span>{author}</span>
            <span style={{ color: "#64748b" }}>•</span>
            <span>{date}</span>
          </div>

          <div
            style={{
              fontSize: "16px",
              color: "#64748b",
              fontWeight: "500",
            }}
          >
            434media.com/blog/{slug}
          </div>
        </div>

        {/* Decorative elements */}
        <div
          style={{
            position: "absolute",
            top: "20%",
            right: "-10%",
            width: "300px",
            height: "300px",
            background: "radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)",
            borderRadius: "50%",
            filter: "blur(40px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "10%",
            left: "-5%",
            width: "200px",
            height: "200px",
            background: "radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)",
            borderRadius: "50%",
            filter: "blur(30px)",
          }}
        />
      </div>,
      {
        width: 1200,
        height: 630,
        fonts: fontData
          ? [
              {
                name: "Inter",
                data: fontData,
                style: "normal",
                weight: 400,
              },
            ]
          : [],
      },
    )
  } catch (error) {
    console.error("Error generating OG image:", error)

    // Enhanced fallback image
    return new ImageResponse(
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0a",
          backgroundImage: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          color: "white",
          fontFamily: "system-ui",
        }}
      >
        <div
          style={{
            fontSize: "72px",
            fontWeight: "700",
            marginBottom: "24px",
            textShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
          }}
        >
          434 MEDIA
        </div>
        <div
          style={{
            fontSize: "32px",
            fontWeight: "500",
            opacity: 0.9,
          }}
        >
          Creative Media & Smart Marketing
        </div>
        <div
          style={{
            fontSize: "18px",
            marginTop: "32px",
            opacity: 0.7,
          }}
        >
          www.434media.com
        </div>
      </div>,
      {
        width: 1200,
        height: 630,
      },
    )
  }
}
