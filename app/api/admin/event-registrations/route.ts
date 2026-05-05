import { NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import {
  getEventRegistrations,
  getEventRegistrationCounts,
  deleteEventRegistration,
  addEventRegistration,
  updateEventRegistration,
  eventRegistrationsToCSV,
  type UpdateEventRegistrationFields,
} from "@/lib/firestore-event-registrations"

// Ensure this route is never cached — always fetch fresh data from Firestore
export const dynamic = "force-dynamic"

async function requireAdmin() {
  const session = await getSession()
  if (!session) {
    return { error: "Unauthorized", status: 401 }
  }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Workspace email required", status: 403 }
  }
  return { session }
}

export async function GET(request: Request) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get("action")
    const event = searchParams.get("event")
    const format = searchParams.get("format")

    // Get counts by event
    if (action === "counts") {
      const counts = await getEventRegistrationCounts()
      return NextResponse.json({ success: true, counts }, {
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      })
    }

    // Get registrations with optional event filter
    const filters = event ? { event } : undefined
    const registrations = await getEventRegistrations(filters)

    // Return as CSV download
    if (format === "csv") {
      const csv = eventRegistrationsToCSV(registrations)
      const filename = event
        ? `event-registrations-${event.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.csv`
        : `event-registrations-all-${new Date().toISOString().split("T")[0]}.csv`

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      })
    }

    return NextResponse.json({ success: true, registrations }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    })
  } catch (error) {
    console.error("Error in event-registrations GET:", error)
    return NextResponse.json(
      { error: "Failed to fetch event registrations" },
      { status: 500 }
    )
  }
}

// Allowed fields for PATCH. Mirrors `UpdateEventRegistrationFields` server-side
// — checkedIn/tags/source are free-edit, firstName/lastName/fullName/company
// are backfill-only (the lib enforces blank-existing).
const FREE_EDIT_KEYS = ["checkedIn", "tags", "source"] as const
const BACKFILL_KEYS = ["firstName", "lastName", "fullName", "company"] as const

export async function PATCH(request: Request) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    const { id, ...rest } = body as Record<string, unknown> & { id?: string }

    if (!id) {
      return NextResponse.json({ error: "Missing registration ID" }, { status: 400 })
    }

    // Whitelist incoming keys. Anything not in the two lists is silently
    // dropped so a confused client can't accidentally write `event` or
    // `email` (which would corrupt identity / provenance).
    const fields: UpdateEventRegistrationFields = {}
    for (const k of FREE_EDIT_KEYS) {
      if (k in rest && rest[k] !== undefined) {
        if (k === "checkedIn") fields.checkedIn = !!rest[k]
        else if (k === "source") fields.source = String(rest[k] ?? "")
        else if (k === "tags" && Array.isArray(rest[k])) {
          fields.tags = (rest[k] as unknown[]).map(String)
        }
      }
    }
    // Toggle-on check-in stamps the timestamp, toggle-off clears it. Mirrors
    // the prior PATCH behavior so the inline check-in toggle keeps working.
    if ("checkedIn" in rest) {
      fields.checkedInAt = fields.checkedIn ? new Date().toISOString() : ""
    }
    for (const k of BACKFILL_KEYS) {
      if (k in rest && typeof rest[k] === "string") {
        const trimmed = (rest[k] as string).trim()
        if (trimmed) fields[k] = trimmed
      }
    }

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: "No editable fields supplied" }, { status: 400 })
    }

    // Auto-derive fullName when first/last are backfilled and fullName itself
    // wasn't provided — keeps the UI consistent without making the client
    // compute it.
    if (
      fields.fullName === undefined &&
      (fields.firstName !== undefined || fields.lastName !== undefined)
    ) {
      const fn = (fields.firstName as string | undefined) ?? ""
      const ln = (fields.lastName as string | undefined) ?? ""
      const composed = `${fn} ${ln}`.trim()
      if (composed) fields.fullName = composed
    }

    const result = await updateEventRegistration(id, fields, {
      editorEmail: authResult.session.email,
    })
    if (result.success) {
      return NextResponse.json({ success: true, fields })
    }
    // Backfill-blocked writes return a structured 409 so the UI can surface
    // "this field already has a value" without a generic 500.
    const status = result.error?.startsWith("Field ") ? 409 : 500
    return NextResponse.json({ error: result.error }, { status })
  } catch (error) {
    console.error("Error in event-registrations PATCH:", error)
    return NextResponse.json(
      { error: "Failed to update event registration" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: "Missing registration ID" }, { status: 400 })
    }

    const result = await deleteEventRegistration(id)
    if (result.success) {
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: result.error }, { status: 500 })
  } catch (error) {
    console.error("Error in event-registrations DELETE:", error)
    return NextResponse.json(
      { error: "Failed to delete event registration" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    const { firstName, lastName, email, company, event, eventName, eventDate, source, tags } = body

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: "First name, last name, and email are required" },
        { status: 400 }
      )
    }

    const registration = {
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      email,
      company: company || null,
      subscribeToFeed: false,
      event: event || "MoreHumanThanHuman2026",
      eventName: eventName || "More Human Than Human",
      eventDate: eventDate || "2026-02-28",
      registeredAt: new Date().toISOString(),
      source: source || "walk-up",
      tags: tags || ["walk-up", "more-human-than-human"],
      pageUrl: "",
    }

    const result = await addEventRegistration(registration)
    if (result.success) {
      return NextResponse.json({
        success: true,
        id: result.id,
        merged: result.merged || false,
        registration: { ...registration, id: result.id },
      })
    }
    return NextResponse.json({ error: result.error }, { status: 500 })
  } catch (error) {
    console.error("Error in event-registrations POST:", error)
    return NextResponse.json(
      { error: "Failed to add event registration" },
      { status: 500 }
    )
  }
}
