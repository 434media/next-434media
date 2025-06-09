import { ImageResponse } from "next/og"
import type { NextRequest } from "next/server"

export const runtime = "edge"

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params

    // Extract title from URL params or use slug as fallback
    const { searchParams } = new URL(request.url)
    const title = searchParams.get("title") || `Blog: ${slug}` // Use slug as fallback
    const category = searchParams.get("category") || "Technology"
    const author = searchParams.get("author") || "434 MEDIA"
    const date = searchParams.get("date") || new Date().toLocaleDateString()

    // Add slug to console for debugging
    console.log(`Generating OG image for blog post: ${slug}`)

    return new ImageResponse(
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0f0f23",
          backgroundImage: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          position: "relative",
        }}
      >
        {/* Background Pattern */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%23ffffff' fillOpacity='0.05'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            opacity: 0.3,
          }}
        />

        {/* Main Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "80px",
            textAlign: "center",
            zIndex: 1,
          }}
        >
          {/* Logo/Brand */}
          <div
            style={{
              fontSize: "32px",
              fontWeight: "bold",
              color: "#ffffff",
              marginBottom: "40px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                backgroundColor: "#ffffff",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                fontWeight: "bold",
                color: "#667eea",
              }}
            >
              434
            </div>
            434 Media
          </div>

          {/* Category Badge */}
          <div
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              color: "#ffffff",
              padding: "8px 20px",
              borderRadius: "20px",
              fontSize: "16px",
              fontWeight: "500",
              marginBottom: "24px",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            {category}
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: "56px",
              fontWeight: "bold",
              color: "#ffffff",
              lineHeight: "1.2",
              marginBottom: "32px",
              maxWidth: "800px",
              textAlign: "center",
            }}
          >
            {title}
          </h1>

          {/* Meta Info */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "24px",
              color: "rgba(255, 255, 255, 0.8)",
              fontSize: "18px",
            }}
          >
            <span>By {author}</span>
            <span>•</span>
            <span>{date}</span>
          </div>

          {/* URL/Slug (small, at bottom) */}
          <div
            style={{
              position: "absolute",
              bottom: "20px",
              fontSize: "14px",
              color: "rgba(255, 255, 255, 0.6)",
            }}
          >
            434media.com/blog/{slug}
          </div>
        </div>

        {/* Bottom Gradient */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "100px",
            background: "linear-gradient(to top, rgba(0,0,0,0.3), transparent)",
          }}
        />
      </div>,
      {
        width: 1200,
        height: 630,
      },
    )
  } catch (error) {
    console.error("Error generating OG image:", error)

    // Fallback OG image
    return new ImageResponse(
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#667eea",
          color: "white",
        }}
      >
        <div style={{ fontSize: "48px", fontWeight: "bold" }}>434 MEDIA</div>
        <div style={{ fontSize: "24px", marginTop: "20px" }}>Blog</div>
      </div>,
      {
        width: 1200,
        height: 630,
      },
    )
  }
}
