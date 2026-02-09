import { NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/app/lib/auth"
import {
  getPMEventsFromAirtable,
  getVendorsFromAirtable,
  getSpeakersFromAirtable,
} from "../../../lib/airtable-project-management"
import {
  getPMEventsFromFirestore,
  getVendorsFromFirestore,
  getSpeakersFromFirestore,
  createPMEventInFirestore,
  updatePMEventInFirestore,
  deletePMEventFromFirestore,
  createVendorInFirestore,
  updateVendorInFirestore,
  deleteVendorFromFirestore,
  createSpeakerInFirestore,
  updateSpeakerInFirestore,
  deleteSpeakerFromFirestore,
  savePMEventsToFirestore,
  saveVendorsToFirestore,
  saveSpeakersToFirestore,
} from "../../../lib/firestore-project-management"

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

// GET - Fetch all project management data
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "all"
    const source = searchParams.get("source") || "firestore"

    let response: Record<string, unknown> = {}

    if (source === "airtable") {
      // Fetch from Airtable
      if (type === "all" || type === "events") {
        response.events = await getPMEventsFromAirtable()
      }
      if (type === "all" || type === "vendors") {
        response.vendors = await getVendorsFromAirtable()
      }
      if (type === "all" || type === "speakers") {
        response.speakers = await getSpeakersFromAirtable()
      }
    } else {
      // Fetch from Firestore (default)
      if (type === "all" || type === "events") {
        response.events = await getPMEventsFromFirestore()
      }
      if (type === "all" || type === "vendors") {
        response.vendors = await getVendorsFromFirestore()
      }
      if (type === "all" || type === "speakers") {
        response.speakers = await getSpeakersFromFirestore()
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Error fetching project management data:", error)
    return NextResponse.json(
      { error: "Failed to fetch project management data" },
      { status: 500 }
    )
  }
}

// POST - Create new item or sync from Airtable
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    const { action, type, data } = body

    // Handle sync action
    if (action === "sync") {
      const results: Record<string, number> = {}
      const errors: string[] = []

      if (type === "all" || type === "events") {
        try {
          const events = await getPMEventsFromAirtable()
          results.events = await savePMEventsToFirestore(events)
        } catch (err: any) {
          console.error("Error syncing events:", err?.message || err)
          errors.push(`Events: ${err?.message || "Unknown error"}`)
          results.events = 0
        }
      }
      if (type === "all" || type === "vendors") {
        try {
          const vendors = await getVendorsFromAirtable()
          results.vendors = await saveVendorsToFirestore(vendors)
        } catch (err: any) {
          console.error("Error syncing vendors:", err?.message || err)
          errors.push(`Vendors: ${err?.message || "Unknown error"}`)
          results.vendors = 0
        }
      }
      if (type === "all" || type === "speakers") {
        try {
          const speakers = await getSpeakersFromAirtable()
          results.speakers = await saveSpeakersToFirestore(speakers)
        } catch (err: any) {
          console.error("Error syncing speakers:", err?.message || err)
          errors.push(`Speakers: ${err?.message || "Unknown error"}`)
          results.speakers = 0
        }
      }

      // Return success with any partial errors
      if (errors.length > 0) {
        return NextResponse.json({
          message: "Sync completed with some errors",
          synced: results,
          errors,
        })
      }

      return NextResponse.json({
        message: "Sync completed successfully",
        synced: results,
      })
    }

    // Handle create action
    if (action === "create") {
      let created: unknown

      switch (type) {
        case "event":
          created = await createPMEventInFirestore(data)
          break
        case "vendor":
          created = await createVendorInFirestore(data)
          break
        case "speaker":
          created = await createSpeakerInFirestore(data)
          break
        default:
          return NextResponse.json(
            { error: "Invalid type specified" },
            { status: 400 }
          )
      }

      return NextResponse.json({ created })
    }

    return NextResponse.json(
      { error: "Invalid action specified" },
      { status: 400 }
    )
  } catch (error) {
    console.error("Error in project management POST:", error)
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    )
  }
}

// PUT - Update existing item
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    const { type, id, data } = body

    if (!id) {
      return NextResponse.json(
        { error: "ID is required for update" },
        { status: 400 }
      )
    }

    let updated: unknown

    switch (type) {
      case "event":
        updated = await updatePMEventInFirestore(id, data)
        break
      case "vendor":
        updated = await updateVendorInFirestore(id, data)
        break
      case "speaker":
        updated = await updateSpeakerInFirestore(id, data)
        break
      default:
        return NextResponse.json(
          { error: "Invalid type specified" },
          { status: 400 }
        )
    }

    return NextResponse.json({ updated })
  } catch (error) {
    console.error("Error in project management PUT:", error)
    return NextResponse.json(
      { error: "Failed to update item" },
      { status: 500 }
    )
  }
}

// DELETE - Delete item
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")
    const id = searchParams.get("id")

    if (!type || !id) {
      return NextResponse.json(
        { error: "Type and ID are required" },
        { status: 400 }
      )
    }

    switch (type) {
      case "event":
        await deletePMEventFromFirestore(id)
        break
      case "vendor":
        await deleteVendorFromFirestore(id)
        break
      case "speaker":
        await deleteSpeakerFromFirestore(id)
        break
      default:
        return NextResponse.json(
          { error: "Invalid type specified" },
          { status: 400 }
        )
    }

    return NextResponse.json({ deleted: true, id, type })
  } catch (error) {
    console.error("Error in project management DELETE:", error)
    return NextResponse.json(
      { error: "Failed to delete item" },
      { status: 500 }
    )
  }
}
