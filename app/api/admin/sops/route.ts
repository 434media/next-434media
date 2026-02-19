import { NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import {
  getSOPsFromFirestore,
  getSOPByIdFromFirestore,
  createSOPInFirestore,
  updateSOPInFirestore,
  deleteSOPFromFirestore,
  saveSOPsToFirestore,
} from "@/lib/firestore-project-management"
import { getSOPsFromAirtable } from "@/lib/airtable-project-management"

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

// GET - Fetch all SOPs or a specific SOP
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (id) {
      const sop = await getSOPByIdFromFirestore(id)
      if (!sop) {
        return NextResponse.json({ error: "SOP not found" }, { status: 404 })
      }
      return NextResponse.json({ sop })
    }

    const sops = await getSOPsFromFirestore()

    return NextResponse.json({ sops, total: sops.length })
  } catch (error) {
    console.error("Error fetching SOPs:", error)
    return NextResponse.json(
      { error: "Failed to fetch SOPs" },
      { status: 500 }
    )
  }
}

// POST - Create new SOP or sync from Airtable
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()

    // Handle sync action
    if (body.action === "sync") {
      try {
        const airtableSOPs = await getSOPsFromAirtable()
        const synced = await saveSOPsToFirestore(airtableSOPs)
        return NextResponse.json({ success: true, synced, message: `Synced ${synced} SOPs from Airtable` })
      } catch (syncError) {
        console.error("Error syncing SOPs from Airtable:", syncError)
        return NextResponse.json(
          { error: syncError instanceof Error ? syncError.message : "Failed to sync from Airtable" },
          { status: 500 }
        )
      }
    }

    const { data } = body

    if (!data || !data.title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      )
    }

    // Ensure content has a default value
    if (!data.content) {
      data.content = ""
    }

    const created = await createSOPInFirestore(data)
    return NextResponse.json({ created })
  } catch (error) {
    console.error("Error creating SOP:", error)
    return NextResponse.json(
      { error: "Failed to create SOP" },
      { status: 500 }
    )
  }
}

// PUT - Update existing SOP
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    const { id, data } = body

    if (!id) {
      return NextResponse.json(
        { error: "ID is required for update" },
        { status: 400 }
      )
    }

    const updated = await updateSOPInFirestore(id, data)
    return NextResponse.json({ updated })
  } catch (error) {
    console.error("Error updating SOP:", error)
    return NextResponse.json(
      { error: "Failed to update SOP" },
      { status: 500 }
    )
  }
}

// DELETE - Delete SOP
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "ID is required" },
        { status: 400 }
      )
    }

    await deleteSOPFromFirestore(id)
    return NextResponse.json({ deleted: true, id })
  } catch (error) {
    console.error("Error deleting SOP:", error)
    return NextResponse.json(
      { error: "Failed to delete SOP" },
      { status: 500 }
    )
  }
}
