import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getSession, setSession, isAuthorizedAdmin } from "@/app/lib/auth"
import { getDb } from "@/app/lib/firebase-admin"

const TEAM_MEMBERS_COLLECTION = "crm_team_members"

// GET - Get current user's profile
export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAuthorizedAdmin(session.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const db = getDb()
    const normalizedEmail = session.email.toLowerCase()

    // Find team member by email
    const snapshot = await db
      .collection(TEAM_MEMBERS_COLLECTION)
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get()

    if (snapshot.empty) {
      // User exists in session but not in team members (shouldn't happen normally)
      return NextResponse.json({
        success: true,
        profile: {
          email: session.email,
          name: session.name,
          picture: session.picture,
          isTeamMember: false,
        },
      })
    }

    const doc = snapshot.docs[0]
    const memberData = doc.data()

    return NextResponse.json({
      success: true,
      profile: {
        id: doc.id,
        email: memberData.email,
        name: memberData.name,
        picture: memberData.picture || session.picture,
        isTeamMember: true,
        isActive: memberData.isActive,
        created_at: memberData.created_at,
      },
    })
  } catch (error) {
    console.error("Error fetching profile:", error)
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    )
  }
}

// PATCH - Update current user's profile (name and/or picture)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAuthorizedAdmin(session.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { name, picture } = body

    // Validate name if provided
    if (name !== undefined && (typeof name !== "string" || name.trim().length < 2)) {
      return NextResponse.json(
        { error: "Name must be at least 2 characters" },
        { status: 400 }
      )
    }

    // Validate picture URL if provided
    if (picture !== undefined && picture !== null && typeof picture !== "string") {
      return NextResponse.json(
        { error: "Invalid picture URL" },
        { status: 400 }
      )
    }

    const db = getDb()
    const normalizedEmail = session.email.toLowerCase()
    const now = new Date().toISOString()

    // Build update object
    const updates: Record<string, string> = { updated_at: now }
    if (name !== undefined) updates.name = name.trim()
    if (picture !== undefined) updates.picture = picture || ""

    // Find team member by email
    const snapshot = await db
      .collection(TEAM_MEMBERS_COLLECTION)
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get()

    if (snapshot.empty) {
      // Create new team member entry
      await db.collection(TEAM_MEMBERS_COLLECTION).add({
        name: name?.trim() || session.name,
        email: normalizedEmail,
        picture: picture || session.picture || "",
        isActive: true,
        created_at: now,
        updated_at: now,
      })
    } else {
      // Update existing team member
      const docId = snapshot.docs[0].id
      await db.collection(TEAM_MEMBERS_COLLECTION).doc(docId).update(updates)
    }

    // Get the final name and picture values
    const finalName = name?.trim() || session.name
    const finalPicture = picture !== undefined ? picture : session.picture

    // Update the session with new values
    await setSession({
      email: session.email,
      name: finalName,
      picture: finalPicture,
    })

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      profile: {
        email: session.email,
        name: finalName,
        picture: finalPicture,
      },
    })
  } catch (error) {
    console.error("Error updating profile:", error)
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    )
  }
}
