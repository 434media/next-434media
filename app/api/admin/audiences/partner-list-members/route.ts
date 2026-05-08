import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import {
  listPartnerListMembers,
  capturePartnerListMember,
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

// GET /api/admin/audiences/partner-list-members
// Optional ?partnerSlug=alamo-angels to scope to one cohort.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  try {
    const partnerSlug = request.nextUrl.searchParams.get("partnerSlug") || undefined
    const members = await listPartnerListMembers({ partnerSlug })
    return NextResponse.json({ success: true, members })
  } catch (err) {
    console.error("[api/audiences/partner-list-members] GET failed:", err)
    return NextResponse.json(
      { error: "Failed to load partner list members" },
      { status: 500 },
    )
  }
}

// POST /api/admin/audiences/partner-list-members
// Single-row upsert. Bulk imports go through /api/admin/leads/import-partner-list,
// which fans into capturePartnerListMember internally.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const email = typeof body.email === "string" ? body.email.trim() : ""
  const partnerSlug = typeof body.partnerSlug === "string" ? body.partnerSlug.trim().toLowerCase() : ""
  const partnerName = typeof body.partnerName === "string" ? body.partnerName.trim() : ""

  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 })
  if (!partnerSlug) {
    return NextResponse.json({ error: "partnerSlug is required" }, { status: 400 })
  }
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(partnerSlug)) {
    return NextResponse.json(
      { error: 'partnerSlug must be a kebab-case identifier (e.g. "alamo-angels")' },
      { status: 400 },
    )
  }
  if (!partnerName) {
    return NextResponse.json({ error: "partnerName is required" }, { status: 400 })
  }

  try {
    const result = await capturePartnerListMember({
      email,
      firstName: typeof body.firstName === "string" ? body.firstName : undefined,
      lastName: typeof body.lastName === "string" ? body.lastName : undefined,
      preferredName: typeof body.preferredName === "string" ? body.preferredName : undefined,
      company: typeof body.company === "string" ? body.company : undefined,
      phone: typeof body.phone === "string" ? body.phone : undefined,
      linkedin: typeof body.linkedin === "string" ? body.linkedin : undefined,
      partnerSlug,
      partnerName,
      joinedAt: typeof body.joinedAt === "string" ? body.joinedAt : undefined,
      extraTags: Array.isArray(body.extraTags) ? (body.extraTags as string[]) : undefined,
      noteSuffix: typeof body.noteSuffix === "string" ? body.noteSuffix : undefined,
    })
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error("[api/audiences/partner-list-members] POST failed:", err)
    return NextResponse.json(
      { error: "Failed to save partner list member" },
      { status: 500 },
    )
  }
}
