import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  try {
    // Ensure we always return JSON
    const headers = {
      "Content-Type": "application/json",
    }

    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("admin-session")

    if (!sessionCookie) {
      return NextResponse.json({ authenticated: false }, { headers })
    }

    // Verify the session cookie value
    const expectedValue = process.env.ADMIN_PASSWORD ? Buffer.from(process.env.ADMIN_PASSWORD).toString("base64") : null

    if (!expectedValue || sessionCookie.value !== expectedValue) {
      return NextResponse.json({ authenticated: false }, { headers })
    }

    return NextResponse.json({ authenticated: true }, { headers })
  } catch (error) {
    console.error("Session check error:", error)
    return NextResponse.json(
      {
        authenticated: false,
        error: "Session check failed",
        details: process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined,
      },
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}
