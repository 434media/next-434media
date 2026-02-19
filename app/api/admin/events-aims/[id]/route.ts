import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { 
  getAimsEventByIdFromFirestore,
  updateAimsEventInFirestore,
  deleteAimsEventFromFirestore
} from "@/lib/firestore-aims-events"

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

// GET - Fetch a single AIMS event (admin only)
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
    const event = await getAimsEventByIdFromFirestore(id)
    
    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ event })
  } catch (error) {
    console.error("Error fetching AIMS event:", error)
    return NextResponse.json(
      { error: "Failed to fetch AIMS event" },
      { status: 500 }
    )
  }
}

// PUT - Update an AIMS event (admin only)
export async function PUT(
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

    // Map admin form fields to Firestore event structure
    const updates = {
      title: body.title?.trim(),
      description: body.description?.trim() || "",
      date: body.start_date,
      time: body.start_time || undefined,
      location: body.location?.trim(),
      organizer: body.organizer?.trim() || "AIMS ATX",
      category: mapCategory(body.category),
      price: body.is_free ? "Free" : (body.price || undefined),
      url: body.event_url || undefined,
      image: body.image_url || undefined,
      isPast: body.status === "past" || false,
    }

    const updatedEvent = await updateAimsEventInFirestore(id, updates)
    
    return NextResponse.json({ 
      success: true, 
      event: updatedEvent,
      message: "AIMS event updated successfully"
    })
  } catch (error) {
    console.error("Error updating AIMS event:", error)
    return NextResponse.json(
      { error: "Failed to update AIMS event" },
      { status: 500 }
    )
  }
}

// DELETE - Delete an AIMS event (admin only)
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
    await deleteAimsEventFromFirestore(id)
    
    return NextResponse.json({ 
      success: true,
      message: "AIMS event deleted successfully"
    })
  } catch (error) {
    console.error("Error deleting AIMS event:", error)
    return NextResponse.json(
      { error: "Failed to delete AIMS event" },
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
