import { ImageResponse } from "next/og"

export const runtime = "edge"

export async function GET() {
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
        backgroundImage: `
          radial-gradient(circle at 25% 25%, #6366f1 0%, transparent 50%),
          radial-gradient(circle at 75% 75%, #8b5cf6 0%, transparent 50%),
          linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)
        `,
        fontFamily: "system-ui",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background pattern */}
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

      {/* Main content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          zIndex: 10,
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              width: "80px",
              height: "80px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              borderRadius: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "32px",
              fontWeight: "700",
              color: "white",
              boxShadow: "0 8px 32px rgba(99, 102, 241, 0.3)",
            }}
          >
            434
          </div>
          <div
            style={{
              fontSize: "48px",
              fontWeight: "700",
              color: "white",
              letterSpacing: "-0.02em",
            }}
          >
            434 MEDIA
          </div>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: "72px",
            fontWeight: "700",
            color: "white",
            lineHeight: "1.1",
            margin: "0 0 24px 0",
            letterSpacing: "-0.02em",
            textShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
          }}
        >
          Blog & Insights
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: "28px",
            color: "#94a3b8",
            margin: "0 0 40px 0",
            maxWidth: "800px",
            lineHeight: "1.4",
          }}
        >
          Creative Media & Smart Marketing Strategies
        </p>

        {/* Gradient line */}
        <div
          style={{
            width: "200px",
            height: "4px",
            background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
            borderRadius: "2px",
          }}
        />
      </div>

      {/* Decorative elements */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          right: "-10%",
          width: "400px",
          height: "400px",
          background: "radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)",
          borderRadius: "50%",
          filter: "blur(60px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          left: "-10%",
          width: "300px",
          height: "300px",
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)",
          borderRadius: "50%",
          filter: "blur(40px)",
        }}
      />
    </div>,
    {
      width: 1200,
      height: 630,
    },
  )
}
