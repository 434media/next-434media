import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/app/lib/auth"
import { 
  getEventsFromFirestore, 
  createEventInFirestore
} from "@/app/lib/firestore-events"

// Check if user is authenticated and has workspace email
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

// GET - Fetch all events (admin only)
export async function GET() {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const events = await getEventsFromFirestore()
    
    // Transform to match admin page expectations
    const transformedEvents = events.map(event => ({
      id: event.id,
      title: event.title,
      description: event.description || "",
      start_date: event.date,
      end_date: event.date,
      start_time: event.time || "",
      end_time: "",
      location: event.location || "",
      venue_name: "",
      venue_address: "",
      image_url: event.image || "",
      event_url: event.url || "",
      source: event.source || "manual",
      category: event.category || "other",
      organizer: event.organizer || "",
      is_virtual: event.location?.toLowerCase().includes("online") || event.location?.toLowerCase().includes("virtual") || false,
      is_free: !event.price || event.price === "Free",
      price: event.price || "",
      status: event.isPast ? "past" : "upcoming",
      created_at: event.created_at || new Date().toISOString(),
      updated_at: event.updated_at || new Date().toISOString()
    }))

    return NextResponse.json({ events: transformedEvents })
  } catch (error) {
    console.error("Error fetching events:", error)
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    )
  }
}

// POST - Create a new event (admin only)
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = await request.json()
    
    // Validate required fields
    if (!body.title?.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      )
    }
    
    if (!body.start_date) {
      return NextResponse.json(
        { error: "Start date is required" },
        { status: 400 }
      )
    }
    
    if (!body.location?.trim()) {
      return NextResponse.json(
        { error: "Location is required" },
        { status: 400 }
      )
    }

    // Map admin form fields to Firestore event structure
    const eventData = {
      title: body.title.trim(),
      description: body.description?.trim() || "",
      date: body.start_date,
      time: body.start_time || undefined,
      location: body.location.trim(),
      organizer: body.organizer?.trim() || undefined,
      category: mapCategory(body.category),
      price: body.is_free ? "Free" : (body.price || undefined),
      url: body.event_url || undefined,
      image: body.image_url || undefined,
      source: "manual" as const,
      isPast: body.status === "past" || false,
      tags: undefined,
      attendees: undefined,
    }

    const newEvent = await createEventInFirestore(eventData)
    
    return NextResponse.json({ 
      success: true, 
      event: newEvent,
      message: "Event created successfully"
    })
  } catch (error) {
    console.error("Error creating event:", error)
    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 }
    )
  }
}

// Helper to map admin categories to Firestore categories
function mapCategory(category: string): "conference" | "workshop" | "meetup" | "networking" | "other" {
  const categoryMap: Record<string, "conference" | "workshop" | "meetup" | "networking" | "other"> = {
    "Conference": "conference",
    "Workshop": "workshop",
    "Meetup": "meetup",
    "Networking": "networking",
    "Webinar": "workshop",
    "Hackathon": "workshop",
    "Social": "networking",
    "Panel": "conference",
    "Launch Party": "networking",
    "Other": "other"
  }
  return categoryMap[category] || "other"
}
