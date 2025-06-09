import { ImageResponse } from "next/og"
import type { NextRequest } from "next/server"
import { sql } from "@vercel/postgres"

export const runtime = "edge"

export async function GET(request: NextRequest, { params }: { params: { slug: string } }): Promise<ImageResponse> {
  try {
    const slug = params.slug

    // Fetch blog post data from database
    const { rows } = await sql`
      SELECT title, excerpt, author
      FROM blog_posts
      WHERE slug = ${slug}
      LIMIT 1
    `

    if (rows.length === 0) {
      return new ImageResponse(
        <div
          style={{
            display: "flex",
            fontSize: 40,
            color: "white",
            background: "#111",
            width: "100%",
            height: "100%",
            padding: "50px 50px",
            textAlign: "center",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          Blog post not found
        </div>,
        {
          width: 1200,
          height: 630,
        },
      )
    }

    const post = rows[0]
    const title = post.title || "434 Media Blog"
    const excerpt = post.excerpt || "Creative Media and Smart Marketing Solutions"
    const author = post.author || "434 Media"

    return new ImageResponse(
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          backgroundColor: "#111",
          backgroundImage: "linear-gradient(to bottom right, #4338ca, #6d28d9, #7e22ce)",
          padding: "40px 50px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Content container */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            zIndex: 10,
          }}
        >
          {/* Header with logo */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <svg width="80" height="80" viewBox="0 0 512 512" fill="none">
              <path
                d="M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256 256-114.6 256-256S397.4 0 256 0zm0 464c-114.7 0-208-93.3-208-208S141.3 48 256 48s208 93.3 208 208-93.3 208-208 208z"
                fill="#ffffff"
              />
              <path
                d="M256 128c-70.7 0-128 57.3-128 128s57.3 128 128 128 128-57.3 128-128-57.3-128-128-128zm0 208c-44.2 0-80-35.8-80-80s35.8-80 80-80 80 35.8 80 80-35.8 80-80 80z"
                fill="#ffffff"
              />
              <path
                d="M256 192c-35.3 0-64 28.7-64 64s28.7 64 64 64 64-28.7 64-64-28.7-64-64-64zm0 80c-8.8 0-16-7.2-16-16s7.2-16 16-16 16 7.2 16 16-7.2 16-16 16z"
                fill="#ffffff"
              />
            </svg>
            <div
              style={{
                marginLeft: "15px",
                fontSize: "28px",
                fontWeight: "bold",
                color: "white",
              }}
            >
              434 MEDIA
            </div>
          </div>

          {/* Main content */}
          <div style={{ maxWidth: "90%" }}>
            <h1
              style={{
                fontSize: "64px",
                fontWeight: "bold",
                color: "white",
                lineHeight: 1.1,
                margin: 0,
                marginBottom: "16px",
              }}
            >
              {title}
            </h1>
            <p
              style={{
                fontSize: "24px",
                color: "#f8fafc",
                margin: 0,
                opacity: 0.9,
              }}
            >
              {excerpt.length > 140 ? excerpt.substring(0, 140) + "..." : excerpt}
            </p>
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
            }}
          >
            <div
              style={{
                fontSize: "18px",
                color: "#e2e8f0",
              }}
            >
              By {author}
            </div>
            <div
              style={{
                fontSize: "18px",
                color: "#e2e8f0",
                display: "flex",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  backgroundColor: "#10b981",
                  marginRight: "8px",
                }}
              />
              www.434media.com
            </div>
          </div>
        </div>
      </div>,
      {
        width: 1200,
        height: 630,
      },
    )
  } catch (error) {
    console.error("Error generating OpenGraph image:", error)
    return new ImageResponse(
      <div
        style={{
          display: "flex",
          fontSize: 40,
          color: "white",
          background: "#111",
          width: "100%",
          height: "100%",
          padding: "50px 50px",
          textAlign: "center",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        Error generating image
      </div>,
      {
        width: 1200,
        height: 630,
      },
    )
  }
}
