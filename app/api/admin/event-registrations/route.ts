import { NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import {
  getEventRegistrations,
  getEventRegistrationCounts,
  deleteEventRegistration,
  addEventRegistration,
  updateEventRegistration,
  eventRegistrationsToCSV,
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

export async function PATCH(request: Request) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    const { id, checkedIn } = body

    if (!id) {
      return NextResponse.json({ error: "Missing registration ID" }, { status: 400 })
    }

    const fields: { checkedIn: boolean; checkedInAt: string } = {
      checkedIn: !!checkedIn,
      checkedInAt: checkedIn ? new Date().toISOString() : "",
    }

    const result = await updateEventRegistration(id, fields)
    if (result.success) {
      return NextResponse.json({ success: true, ...fields })
    }
    return NextResponse.json({ error: result.error }, { status: 500 })
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
