import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import {
  getPartnerListMember,
  updatePartnerListMember,
  deletePartnerListMember,
} from "@/lib/firestore-partner-list-members"

export const runtime = "nodejs"

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { id } = await params
  try {
    const member = await getPartnerListMember(id)
    if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ success: true, member })
  } catch (err) {
    console.error("[api/audiences/partner-list-members/:id] GET failed:", err)
    return NextResponse.json({ error: "Failed to load member" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Pluck only fields we permit a client to patch. Identity (email) and
  // import provenance are immutable post-creation.
  const patch: Record<string, unknown> = {}
  for (const key of [
    "firstName",
    "lastName",
    "preferredName",
    "fullName",
    "company",
    "phone",
    "linkedin",
    "tags",
    "notes",
  ]) {
    if (key in body) patch[key as keyof typeof body] = body[key]
  }

  try {
    await updatePartnerListMember(id, patch)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[api/audiences/partner-list-members/:id] PATCH failed:", err)
    return NextResponse.json({ error: "Failed to update member" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { id } = await params
  try {
    await deletePartnerListMember(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[api/audiences/partner-list-members/:id] DELETE failed:", err)
    return NextResponse.json({ error: "Failed to delete member" }, { status: 500 })
  }
}
