import { NextResponse } from "next/server"
import { getDb } from "@/lib/firebase-admin"
import {
  getSession,
  isAuthorizedAdmin,
  isCrmSuperAdmin,
  CRM_SUPER_ADMIN_FALLBACK,
  type AdminRole,
} from "@/lib/auth"

const TEAM_MEMBERS_COLLECTION = "crm_team_members"

export interface TeamMember {
  id: string
  name: string
  email: string
  isActive: boolean
  role: AdminRole
  created_at: string
  updated_at: string
}

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

async function requireSuperAdmin() {
  const auth = await requireAdmin()
  if ("error" in auth) return auth
  const ok = await isCrmSuperAdmin(auth.session.email)
  if (!ok) return { error: "Forbidden: Super admin required", status: 403 as const }
  return auth
}

/**
 * Canonical full names for the hardcoded super-admin fallback.
 * MUST match the names used elsewhere in the CRM (TEAM_MEMBERS in
 * components/crm/types.ts, OWNER_MAP, normalizeAssigneeName) so that
 * filtering "show me my clients" actually matches `client.assigned_to`.
 */
const SUPER_ADMIN_CANONICAL_NAMES: Record<string, string> = {
  "marcos@434media.com": "Marcos Resendez",
  "jesse@434media.com": "Jesse Hernandez",
}

/**
 * Silent backfill: ensure the hardcoded fallback super-admins have
 * `role: "crm_super_admin"` AND the canonical full name in Firestore.
 * Runs on every GET; idempotent. Self-heals records seeded by an earlier
 * version of this backfill that used a short name (e.g., "Jesse" instead
 * of "Jesse Hernandez") which broke assignee filtering across the CRM.
 */
async function ensureSuperAdminBackfill(): Promise<{ promoted: string[]; renamed: string[] }> {
  const db = getDb()
  const promoted: string[] = []
  const renamed: string[] = []
  for (const email of CRM_SUPER_ADMIN_FALLBACK) {
    const canonicalName = SUPER_ADMIN_CANONICAL_NAMES[email] ?? email.split("@")[0]
    const snap = await db
      .collection(TEAM_MEMBERS_COLLECTION)
      .where("email", "==", email)
      .limit(1)
      .get()
    if (snap.empty) {
      await db.collection(TEAM_MEMBERS_COLLECTION).add({
        name: canonicalName,
        email,
        isActive: true,
        role: "crm_super_admin",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      promoted.push(email)
      continue
    }
    const doc = snap.docs[0]
    const data = doc.data()
    const updates: Record<string, unknown> = {}
    if (data.role !== "crm_super_admin") {
      updates.role = "crm_super_admin"
      promoted.push(email)
    }
    // Heal records that were created with a wrong/short name
    if (data.name !== canonicalName) {
      updates.name = canonicalName
      renamed.push(email)
    }
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString()
      await doc.ref.update(updates)
    }
  }
  return { promoted, renamed }
}

// GET — Fetch all team members. Open to any authenticated admin.
// Triggers a silent backfill so the role list is always current.
export async function GET() {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    await ensureSuperAdminBackfill().catch((err) =>
      console.error("[team-members] backfill failed (continuing):", err),
    )

    const db = getDb()
    const snapshot = await db.collection(TEAM_MEMBERS_COLLECTION).orderBy("name", "asc").get()
    const members: TeamMember[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<TeamMember, "id">),
      // Default any missing role to "crm_only" so the UI never sees undefined
      role: (doc.data().role as AdminRole) ?? "crm_only",
    }))

    return NextResponse.json({ success: true, data: members })
  } catch (error) {
    console.error("Error fetching team members:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch team members" },
      { status: 500 },
    )
  }
}

// POST — Add a team member. Super-admin only.
export async function POST(request: Request) {
  try {
    const authResult = await requireSuperAdmin()
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    const { name, email, role } = body as { name?: string; email?: string; role?: AdminRole }

    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: "Name is required" },
        { status: 400 },
      )
    }

    const trimmedEmail = email?.trim().toLowerCase() || ""
    if (trimmedEmail && !trimmedEmail.endsWith("@434media.com")) {
      return NextResponse.json(
        { success: false, error: "Email must be a @434media.com address" },
        { status: 400 },
      )
    }

    const db = getDb()
    if (trimmedEmail) {
      const existing = await db
        .collection(TEAM_MEMBERS_COLLECTION)
        .where("email", "==", trimmedEmail)
        .limit(1)
        .get()
      if (!existing.empty) {
        return NextResponse.json(
          { success: false, error: `A member with email ${trimmedEmail} already exists` },
          { status: 409 },
        )
      }
    }

    const now = new Date().toISOString()
    const newMember = {
      name: name.trim(),
      email: trimmedEmail,
      isActive: true,
      role: (role && ["crm_super_admin", "full_admin", "crm_only"].includes(role) ? role : "crm_only") as AdminRole,
      created_at: now,
      updated_at: now,
    }

    const docRef = await db.collection(TEAM_MEMBERS_COLLECTION).add(newMember)

    return NextResponse.json({
      success: true,
      data: { id: docRef.id, ...newMember },
    })
  } catch (error) {
    console.error("Error creating team member:", error)
    return NextResponse.json(
      { success: false, error: "Failed to create team member" },
      { status: 500 },
    )
  }
}

// DELETE — Soft-delete a team member. Super-admin only. Cannot delete self.
export async function DELETE(request: Request) {
  try {
    const authResult = await requireSuperAdmin()
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Member ID is required" },
        { status: 400 },
      )
    }

    const db = getDb()
    const doc = await db.collection(TEAM_MEMBERS_COLLECTION).doc(id).get()
    if (!doc.exists) {
      return NextResponse.json({ success: false, error: "Member not found" }, { status: 404 })
    }
    const memberEmail = (doc.data()?.email as string | undefined)?.toLowerCase()
    if (memberEmail && memberEmail === authResult.session.email.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: "You cannot deactivate your own account" },
        { status: 400 },
      )
    }

    await db.collection(TEAM_MEMBERS_COLLECTION).doc(id).update({
      isActive: false,
      updated_at: new Date().toISOString(),
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting team member:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete team member" },
      { status: 500 },
    )
  }
}

// PATCH — Update a team member. Super-admin only. Cannot demote self from super-admin.
export async function PATCH(request: Request) {
  try {
    const authResult = await requireSuperAdmin()
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    const { id, name, email, isActive, role } = body as {
      id?: string
      name?: string
      email?: string
      isActive?: boolean
      role?: AdminRole
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Member ID is required" },
        { status: 400 },
      )
    }

    const db = getDb()
    const doc = await db.collection(TEAM_MEMBERS_COLLECTION).doc(id).get()
    if (!doc.exists) {
      return NextResponse.json({ success: false, error: "Member not found" }, { status: 404 })
    }

    const existing = doc.data() as TeamMember
    const targetEmail = (existing.email || "").toLowerCase()
    const isSelf = targetEmail && targetEmail === authResult.session.email.toLowerCase()

    // Hard-prevent self-demotion / self-deactivation. The other super-admin
    // can always make these changes if needed.
    if (isSelf) {
      if (role !== undefined && role !== "crm_super_admin") {
        return NextResponse.json(
          {
            success: false,
            error: "You cannot demote yourself. Ask the other super-admin to do it.",
          },
          { status: 400 },
        )
      }
      if (isActive === false) {
        return NextResponse.json(
          { success: false, error: "You cannot deactivate your own account" },
          { status: 400 },
        )
      }
    }

    const updates: Partial<TeamMember> = { updated_at: new Date().toISOString() }
    if (name !== undefined) updates.name = name.trim()
    if (email !== undefined) updates.email = email.trim().toLowerCase()
    if (isActive !== undefined) updates.isActive = isActive
    if (role !== undefined) {
      if (!["crm_super_admin", "full_admin", "crm_only"].includes(role)) {
        return NextResponse.json(
          { success: false, error: `Invalid role: ${role}` },
          { status: 400 },
        )
      }
      updates.role = role
    }

    await db.collection(TEAM_MEMBERS_COLLECTION).doc(id).update(updates)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating team member:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update team member" },
      { status: 500 },
    )
  }
}
