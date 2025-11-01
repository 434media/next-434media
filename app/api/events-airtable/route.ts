import { type NextRequest, NextResponse } from "next/server"
import { 
  getEventsFromAirtable, 
  createEventInAirtable,
  testAirtableConnection 
} from "../../lib/airtable-events"

export async function GET() {
  try {
    // Test connection first
    const isConnected = await testAirtableConnection()
    if (!isConnected) {
      return NextResponse.json({ error: "Airtable connection failed" }, { status: 503 })
    }

    // Fetch events from Airtable
    const events = await getEventsFromAirtable()
    return NextResponse.json(events)
  } catch (error) {
    console.error("Error fetching events from Airtable:", error)
    return NextResponse.json({ error: "Failed to fetch events from Airtable" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Test connection first
    const isConnected = await testAirtableConnection()
    if (!isConnected) {
      return NextResponse.json({ error: "Airtable connection failed" }, { status: 503 })
    }

    const eventData = await request.json()
    const newEvent = await createEventInAirtable(eventData)
    return NextResponse.json(newEvent)
  } catch (error) {
    console.error("Error creating event in Airtable:", error)
    return NextResponse.json({ error: "Failed to create event in Airtable" }, { status: 500 })
  }
}