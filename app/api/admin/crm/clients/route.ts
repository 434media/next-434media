import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  getClientsByStatus,
} from "@/lib/firestore-crm"

// Check admin access
async function requireAdmin() {
  const session = await getSession()

  if (!session) {
    return { error: "Unauthorized", status: 401 }
  }

  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 }
  }

  return { session }
}

// GET - Fetch all clients or filter by status
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const id = searchParams.get("id")

    // Get single client by ID
    if (id) {
      const client = await getClientById(id)
      if (!client) {
        return NextResponse.json(
          { error: "Client not found" },
          { status: 404 }
        )
      }
      return NextResponse.json({ success: true, client })
    }

    // Get clients by status filter
    if (status && status !== "all") {
      const clients = await getClientsByStatus(status)
      return NextResponse.json({ success: true, clients })
    }

    // Get all clients
    const clients = await getClients()
    return NextResponse.json({ success: true, clients })
  } catch (error) {
    console.error("Error fetching clients:", error)
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 }
    )
  }
}

// POST - Create a new client
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
    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "Client name is required" },
        { status: 400 }
      )
    }

    const client = await createClient({
      name: body.name.trim(),
      company_name: body.company_name || "",
      department: body.department || "",  // For large clients with multiple departments
      title: body.title || "",
      email: body.email || "",
      phone: body.phone || "",
      contacts: body.contacts || [],
      industry: body.industry || "",
      website: body.website || "",
      address: body.address || "",
      city: body.city || "",
      state: body.state || "",
      zip_code: body.zip_code || "",
      status: body.status || "prospect",
      lead_source: body.lead_source || "",
      assigned_to: body.assigned_to || "",
      last_contact_date: body.last_contact_date || "",
      next_followup_date: body.next_followup_date || "",
      notes: body.notes || "",
      lifetime_value: body.lifetime_value || 0,
      monthly_retainer: body.monthly_retainer || 0,
      pitch_value: body.pitch_value || 0,
      instagram_handle: body.instagram_handle || "",
      linkedin_url: body.linkedin_url || "",
      source: body.source || "",
      brand: body.brand || "",
      is_opportunity: body.is_opportunity || false,
      disposition: body.disposition || undefined,
      doc: body.doc || undefined,
      web_links: body.web_links || [],
      docs: body.docs || [],
    })

    return NextResponse.json({ success: true, client }, { status: 201 })
  } catch (error) {
    console.error("Error creating client:", error)
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    )
  }
}

// PUT - Update an existing client
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = await request.json()

    if (!body.id) {
      return NextResponse.json(
        { error: "Client ID is required" },
        { status: 400 }
      )
    }

    const { id, ...updates } = body
    
    // Debug: Log what's being updated
    console.log("=== Client Update ===")
    console.log("Client ID:", id)
    console.log("Updates:", JSON.stringify(updates, null, 2))
    
    const client = await updateClient(id, updates)
    
    console.log("Updated client result:", {
      id: client.id,
      disposition: client.disposition,
      pitch_value: client.pitch_value,
      is_opportunity: client.is_opportunity,
    })
    console.log("=====================")

    return NextResponse.json({ success: true, client })
  } catch (error) {
    console.error("Error updating client:", error)
    return NextResponse.json(
      { error: "Failed to update client" },
      { status: 500 }
    )
  }
}

// DELETE - Delete a client
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "Client ID is required" },
        { status: 400 }
      )
    }

    await deleteClient(id)

    return NextResponse.json({ success: true, message: "Client deleted" })
  } catch (error) {
    console.error("Error deleting client:", error)
    return NextResponse.json(
      { error: "Failed to delete client" },
      { status: 500 }
    )
  }
}
