import { type NextRequest, NextResponse } from "next/server"
import { getEvents, createEvent, deleteOldEvents } from "../../lib/db"

export async function GET() {
  try {
    // First, clean up old events
    await deleteOldEvents()

    // Then fetch current events
    const events = await getEvents()
    return NextResponse.json(events)
  } catch (error) {
    console.error("Error fetching events:", error)
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const eventData = await request.json()
    const newEvent = await createEvent(eventData)
    return NextResponse.json(newEvent)
  } catch (error) {
    console.error("Error creating event:", error)
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 })
  }
}
