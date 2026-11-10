import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { parseEventUrl } from "@/lib/event-parser"

/**
 * Admin tooling: the events page (/admin/events) pastes a Meetup, Eventbrite or Luma link and gets the event's fields
 * back. Its only caller is that page, same-origin, so the route is behind the admin gate and sends no CORS headers
 * (security log PSM-1). The fetch itself is limited to those three hosts in lib/event-parser.
 */
export const runtime = "nodejs"

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 })
    }

    const result = await parseEventUrl(url)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json(result.data)
  } catch (error) {
    console.error("[POST /api/parse-event]", error)

    return NextResponse.json(
      {
        error: "An unexpected error occurred while parsing the event. Please try again.",
      },
      { status: 500 },
    )
  }
}
