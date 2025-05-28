import { NextResponse } from "next/server"

// Rate limiting for brute force protection
const attempts = new Map<string, { count: number; lastAttempt: number }>()

export async function POST(request: Request) {
  try {
    // Get client IP (in production, use headers)
    const clientIP = "127.0.0.1" // Replace with actual IP detection in production

    // Rate limiting check
    const now = Date.now()
    const clientAttempts = attempts.get(clientIP)

    if (clientAttempts && clientAttempts.count >= 5 && now - clientAttempts.lastAttempt < 300000) {
      // 5 minutes lockout after 5 failed attempts
      return NextResponse.json(
        {
          success: false,
          error: "Too many failed attempts. Please try again later.",
        },
        { status: 429 },
      )
    }

    // Get password from request
    const { password } = await request.json()

    // Check if password is provided
    if (!password) {
      return NextResponse.json(
        {
          success: false,
          error: "Password is required",
        },
        { status: 400 },
      )
    }

    // Verify against environment variable
    const adminPassword = process.env.ADMIN_PASSWORD

    if (!adminPassword) {
      console.error("ADMIN_PASSWORD environment variable is not set")
      return NextResponse.json(
        {
          success: false,
          error: "Server configuration error",
        },
        { status: 500 },
      )
    }

    // Timing-safe comparison to prevent timing attacks
    const isValid = timingSafeEqual(password, adminPassword)

    if (!isValid) {
      // Track failed attempt
      const current = attempts.get(clientIP) || { count: 0, lastAttempt: 0 }
      attempts.set(clientIP, { count: current.count + 1, lastAttempt: now })

      // Log failed attempt (in production, use secure logging)
      console.warn(`Failed admin login attempt from ${clientIP}`)

      return NextResponse.json(
        {
          success: false,
          error: "Invalid admin password",
        },
        { status: 401 },
      )
    }

    // Reset attempts on successful verification
    attempts.delete(clientIP)

    // Return success
    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error("Error verifying admin password:", error)
    return NextResponse.json(
      {
        success: false,
        error: "An error occurred during verification",
      },
      { status: 500 },
    )
  }
}

// Timing-safe comparison to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}
