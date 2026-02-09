import { NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/app/lib/auth"
import { getSOPsFromAirtable } from "../../../lib/airtable-project-management"
import {
  getSOPsFromFirestore,
  getSOPByIdFromFirestore,
  createSOPInFirestore,
  updateSOPInFirestore,
  deleteSOPFromFirestore,
  saveSOPsToFirestore,
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

// GET - Fetch all SOPs or a specific SOP
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const source = searchParams.get("source") || "firestore"

    if (id) {
      const sop = await getSOPByIdFromFirestore(id)
      if (!sop) {
        return NextResponse.json({ error: "SOP not found" }, { status: 404 })
      }
      return NextResponse.json({ sop })
    }

    let sops
    if (source === "airtable") {
      sops = await getSOPsFromAirtable()
    } else {
      sops = await getSOPsFromFirestore()
    }

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
    const { action, data } = body

    // Handle sync action
    if (action === "sync") {
      try {
        const sops = await getSOPsFromAirtable()
        const count = await saveSOPsToFirestore(sops)
        return NextResponse.json({
          message: "Sync completed successfully",
          synced: count,
        })
      } catch (error) {
        console.error("Error syncing SOPs:", error)
        return NextResponse.json(
          { error: "Failed to sync SOPs - table may not exist in Airtable" },
          { status: 500 }
        )
      }
    }

    // Handle create action
    if (!data || !data.title || !data.content) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      )
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
