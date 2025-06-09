import { ImageResponse } from "next/og"
import type { NextRequest } from "next/server"
import { getBlogPostBySlug } from "../../../lib/blog-db"

export const runtime = "edge"

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params

    if (!slug) {
      return new Response("Slug is required", { status: 400 })
    }

    // Get the blog post
    const post = await getBlogPostBySlug(slug)

    if (!post) {
      return new Response("Blog post not found", { status: 404 })
    }

    // Create the OG image
    return new ImageResponse(
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1f2937",
          backgroundImage: "linear-gradient(135deg, #1f2937 0%, #111827 100%)",
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
            backgroundImage: `url('https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONWHITE.png')`,
            backgroundSize: "100px 100px",
            backgroundRepeat: "repeat",
            opacity: 0.05,
          }}
        />

        {/* Content */}
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
          {/* Category Badge */}
          {post.category && (
            <div
              style={{
                backgroundColor: "#10b981",
                color: "white",
                padding: "8px 24px",
                borderRadius: "20px",
                fontSize: "18px",
                fontWeight: "600",
                marginBottom: "24px",
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}
            >
              {post.category}
            </div>
          )}

          {/* Title */}
          <h1
            style={{
              fontSize: "64px",
              fontWeight: "bold",
              color: "white",
              lineHeight: "1.1",
              marginBottom: "24px",
              maxWidth: "900px",
              textAlign: "center",
            }}
          >
            {post.title}
          </h1>

          {/* Excerpt */}
          {post.excerpt && (
            <p
              style={{
                fontSize: "24px",
                color: "#d1d5db",
                lineHeight: "1.4",
                maxWidth: "800px",
                textAlign: "center",
                marginBottom: "32px",
              }}
            >
              {post.excerpt.length > 120 ? `${post.excerpt.substring(0, 120)}...` : post.excerpt}
            </p>
          )}

          {/* Author and Date */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "24px",
              fontSize: "18px",
              color: "#9ca3af",
            }}
          >
            <span>{post.author || "434 MEDIA"}</span>
            <span>•</span>
            <span>
              {new Date(post.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            {post.read_time && (
              <>
                <span>•</span>
                <span>{post.read_time} min read</span>
              </>
            )}
          </div>
        </div>

        {/* 434 MEDIA Logo */}
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            right: "40px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              backgroundImage: `url('https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONWHITE.png')`,
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
            }}
          />
          <span
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: "white",
            }}
          >
            434 MEDIA
          </span>
        </div>
      </div>,
      {
        width: 1200,
        height: 630,
      },
    )
  } catch (error) {
    console.error("Error generating OG image:", error)

    // Return a fallback OG image
    return new ImageResponse(
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1f2937",
          color: "white",
        }}
      >
        <h1 style={{ fontSize: "48px", fontWeight: "bold" }}>434 MEDIA</h1>
        <p style={{ fontSize: "24px", color: "#d1d5db" }}>News & Insights</p>
      </div>,
      {
        width: 1200,
        height: 630,
      },
    )
  }
}
