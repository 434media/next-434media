import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(request: NextRequest) {
  try {
    // Ensure we always return JSON
    const headers = {
      "Content-Type": "application/json",
    }

    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError)
      return NextResponse.json({ success: false, error: "Invalid JSON in request body" }, { status: 400, headers })
    }

    const { password } = body

    if (!password) {
      return NextResponse.json({ success: false, error: "Password is required" }, { status: 400, headers })
    }

    const adminPassword = process.env.ADMIN_PASSWORD

    if (!adminPassword) {
      console.error("ADMIN_PASSWORD environment variable not set")
      return NextResponse.json(
        { success: false, error: "Admin password not configured on server" },
        { status: 500, headers },
      )
    }

    if (password !== adminPassword) {
      return NextResponse.json({ success: false, error: "Invalid password" }, { status: 401, headers })
    }

    // Set session cookie that expires in 24 hours
    const cookieStore = await cookies()
    const sessionValue = Buffer.from(adminPassword).toString("base64")

    cookieStore.set("admin-session", sessionValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60, // 24 hours
      path: "/",
    })

    return NextResponse.json({ success: true }, { headers })
  } catch (error) {
    console.error("Admin verification error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details:
          process.env.NODE_ENV === "development" && error && typeof error === "object" && "message" in error
            ? (error as { message?: string }).message
            : undefined,
      },
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}
