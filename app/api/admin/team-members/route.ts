import { NextResponse } from "next/server"
import { getDb } from "@/app/lib/firebase-admin"
import { getSession, isAuthorizedAdmin } from "@/app/lib/auth"

const TEAM_MEMBERS_COLLECTION = "crm_team_members"

export interface TeamMember {
  id: string
  name: string
  email: string
  isActive: boolean
  created_at: string
  updated_at: string
}

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

// GET - Fetch all team members
export async function GET() {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const db = getDb()
    const snapshot = await db
      .collection(TEAM_MEMBERS_COLLECTION)
      .orderBy("name", "asc")
      .get()

    const members: TeamMember[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as TeamMember[]

    return NextResponse.json({ success: true, data: members })
  } catch (error) {
    console.error("Error fetching team members:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch team members" },
      { status: 500 }
    )
  }
}

// POST - Add a new team member
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email } = body

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Name is required" },
        { status: 400 }
      )
    }

    const db = getDb()
    const now = new Date().toISOString()

    const newMember = {
      name: name.trim(),
      email: email?.trim() || "",
      isActive: true,
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
      { status: 500 }
    )
  }
}

// DELETE - Remove a team member (soft delete by setting isActive to false)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Member ID is required" },
        { status: 400 }
      )
    }

    const db = getDb()
    const now = new Date().toISOString()

    // Soft delete - set isActive to false
    await db.collection(TEAM_MEMBERS_COLLECTION).doc(id).update({
      isActive: false,
      updated_at: now,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting team member:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete team member" },
      { status: 500 }
    )
  }
}

// PATCH - Update a team member
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, name, email, isActive } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Member ID is required" },
        { status: 400 }
      )
    }

    const db = getDb()
    const now = new Date().toISOString()

    const updates: Partial<TeamMember> = { updated_at: now }
    if (name !== undefined) updates.name = name.trim()
    if (email !== undefined) updates.email = email.trim()
    if (isActive !== undefined) updates.isActive = isActive

    await db.collection(TEAM_MEMBERS_COLLECTION).doc(id).update(updates)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating team member:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update team member" },
      { status: 500 }
    )
  }
}
