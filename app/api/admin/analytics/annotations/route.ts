import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import {
  getAnnotations,
  createAnnotation,
  deleteAnnotation,
} from "@/lib/firestore-annotations"

export const runtime = "nodejs"

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

// GET /api/admin/analytics/annotations?propertyId=<id>
export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const propertyId = request.nextUrl.searchParams.get("propertyId")
  if (!propertyId) {
    return NextResponse.json({ error: "propertyId is required" }, { status: 400 })
  }
  try {
    const annotations = await getAnnotations(propertyId)
    return NextResponse.json({ success: true, annotations })
  } catch (err) {
    console.error("[GET annotations]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load annotations" },
      { status: 500 },
    )
  }
}

// POST /api/admin/analytics/annotations  body: { propertyId, date, label, note? }
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: { propertyId?: string; date?: string; label?: string; note?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const propertyId = typeof body.propertyId === "string" ? body.propertyId : ""
  const date = typeof body.date === "string" ? body.date : ""
  const label = typeof body.label === "string" ? body.label.trim() : ""
  const note = typeof body.note === "string" ? body.note.trim() : ""

  if (!propertyId) return NextResponse.json({ error: "propertyId is required" }, { status: 400 })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 })
  }
  if (!label) return NextResponse.json({ error: "label is required" }, { status: 400 })

  try {
    const annotation = await createAnnotation({
      propertyId,
      date,
      label,
      note: note || undefined,
      createdBy: auth.session.email,
    })
    return NextResponse.json({ success: true, annotation }, { status: 201 })
  } catch (err) {
    console.error("[POST annotations]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create annotation" },
      { status: 500 },
    )
  }
}

// DELETE /api/admin/analytics/annotations?id=<id>
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const id = request.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
  try {
    await deleteAnnotation(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE annotation]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete annotation" },
      { status: 500 },
    )
  }
}
