import { type NextRequest, NextResponse } from "next/server"
import { getSession, isWorkspaceEmail } from "@/app/lib/auth"
import { 
  getEventByIdFromFirestore,
  updateEventInFirestore, 
  deleteEventFromFirestore
} from "@/app/lib/firestore-events"

// Check if user is authenticated and has workspace email
async function requireAdmin() {
  const session = await getSession()
  
  if (!session) {
    return { error: "Unauthorized", status: 401 }
  }
  
  if (!isWorkspaceEmail(session.email)) {
    return { error: "Forbidden: Workspace email required", status: 403 }
  }
  
  return { session }
}

// GET - Fetch a specific event (admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { id } = await params
    const event = await getEventByIdFromFirestore(id)
    
    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ event })
  } catch (error) {
    console.error("Error fetching event:", error)
    return NextResponse.json(
      { error: "Failed to fetch event" },
      { status: 500 }
    )
  }
}

// PATCH - Update an event (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { id } = await params
    const body = await request.json()
    
    // Validate required fields
    if (body.title !== undefined && !body.title?.trim()) {
      return NextResponse.json(
        { error: "Title cannot be empty" },
        { status: 400 }
      )
    }

    // Check if event exists
    const existingEvent = await getEventByIdFromFirestore(id)
    if (!existingEvent) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      )
    }

    // Map admin form fields to Firestore event structure
    const updates: Record<string, unknown> = {}
    
    if (body.title !== undefined) updates.title = body.title.trim()
    if (body.description !== undefined) updates.description = body.description.trim()
    if (body.start_date !== undefined) updates.date = body.start_date
    if (body.start_time !== undefined) updates.time = body.start_time
    if (body.location !== undefined) updates.location = body.location.trim()
    if (body.organizer !== undefined) updates.organizer = body.organizer.trim()
    if (body.category !== undefined) updates.category = mapCategory(body.category)
    if (body.image_url !== undefined) updates.image = body.image_url
    if (body.event_url !== undefined) updates.url = body.event_url
    if (body.status !== undefined) updates.isPast = body.status === "past"
    if (body.is_free !== undefined) {
      updates.price = body.is_free ? "Free" : (body.price || undefined)
    } else if (body.price !== undefined) {
      updates.price = body.price
    }

    const updatedEvent = await updateEventInFirestore(id, updates)
    
    return NextResponse.json({ 
      success: true, 
      event: updatedEvent,
      message: "Event updated successfully"
    })
  } catch (error) {
    console.error("Error updating event:", error)
    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 }
    )
  }
}

// DELETE - Delete an event (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { id } = await params
    
    // Check if event exists
    const existingEvent = await getEventByIdFromFirestore(id)
    if (!existingEvent) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      )
    }

    await deleteEventFromFirestore(id)
    
    return NextResponse.json({ 
      success: true, 
      message: "Event deleted successfully"
    })
  } catch (error) {
    console.error("Error deleting event:", error)
    return NextResponse.json(
      { error: "Failed to delete event" },
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
