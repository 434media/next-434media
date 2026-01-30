import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/app/lib/auth"
import {
  getSalesReps,
  getSalesRepById,
  createSalesRep,
  updateSalesRep,
  deleteSalesRep,
} from "@/app/lib/firestore-crm"

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

// GET - Fetch all sales reps or single by ID
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
    const id = searchParams.get("id")

    if (id) {
      const salesRep = await getSalesRepById(id)
      if (!salesRep) {
        return NextResponse.json(
          { error: "Sales rep not found" },
          { status: 404 }
        )
      }
      return NextResponse.json({ success: true, salesRep })
    }

    const salesReps = await getSalesReps()
    return NextResponse.json({ success: true, salesReps })
  } catch (error) {
    console.error("Error fetching sales reps:", error)
    return NextResponse.json(
      { error: "Failed to fetch sales reps" },
      { status: 500 }
    )
  }
}

// POST - Create a new sales rep
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

    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      )
    }

    if (!body.email?.trim()) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    const salesRep = await createSalesRep({
      name: body.name.trim(),
      email: body.email.trim(),
      phone: body.phone || "",
      title: body.title || "",
      department: body.department || "Sales",
      is_active: body.is_active !== false,
      quota: body.quota || 0,
      quota_period: body.quota_period || "monthly",
      client_ids: body.client_ids || [],
      opportunity_ids: body.opportunity_ids || [],
      avatar_url: body.avatar_url || "",
      notes: body.notes || "",
    })

    return NextResponse.json({ success: true, salesRep }, { status: 201 })
  } catch (error) {
    console.error("Error creating sales rep:", error)
    return NextResponse.json(
      { error: "Failed to create sales rep" },
      { status: 500 }
    )
  }
}

// PUT - Update a sales rep
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
        { error: "Sales rep ID is required" },
        { status: 400 }
      )
    }

    const { id, ...updates } = body
    const salesRep = await updateSalesRep(id, updates)

    return NextResponse.json({ success: true, salesRep })
  } catch (error) {
    console.error("Error updating sales rep:", error)
    return NextResponse.json(
      { error: "Failed to update sales rep" },
      { status: 500 }
    )
  }
}

// DELETE - Delete a sales rep
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
        { error: "Sales rep ID is required" },
        { status: 400 }
      )
    }

    await deleteSalesRep(id)

    return NextResponse.json({ success: true, message: "Sales rep deleted" })
  } catch (error) {
    console.error("Error deleting sales rep:", error)
    return NextResponse.json(
      { error: "Failed to delete sales rep" },
      { status: 500 }
    )
  }
}
