import { NextResponse } from "next/server"
import { getDb } from "@/lib/firebase-admin"

const TEAM_MEMBERS_COLLECTION = "crm_team_members"

// Default team members to seed
const DEFAULT_TEAM_MEMBERS = [
  { name: "Jacob Lee Miles", email: "jake@434media.com" },
  { name: "Marcos Resendez", email: "marcos@434media.com" },
  { name: "Stacy Ramirez", email: "stacy@434media.com" },
  { name: "Jesse Hernandez", email: "jesse@434media.com" },
  { name: "Barbara Carreon", email: "barb@434media.com" },
  { name: "Nichole Snow", email: "nichole@434media.com" },
]

// POST - Seed team members (run once to initialize)
export async function POST() {
  try {
    const db = getDb()
    const now = new Date().toISOString()

    // Check if collection already has members
    const existing = await db.collection(TEAM_MEMBERS_COLLECTION).limit(1).get()
    if (!existing.empty) {
      return NextResponse.json({
        success: true,
        message: "Team members already seeded",
      })
    }

    // Add default team members
    const batch = db.batch()
    for (const member of DEFAULT_TEAM_MEMBERS) {
      const docRef = db.collection(TEAM_MEMBERS_COLLECTION).doc()
      batch.set(docRef, {
        ...member,
        isActive: true,
        created_at: now,
        updated_at: now,
      })
    }

    await batch.commit()

    return NextResponse.json({
      success: true,
      message: `Seeded ${DEFAULT_TEAM_MEMBERS.length} team members`,
    })
  } catch (error) {
    console.error("Error seeding team members:", error)
    return NextResponse.json(
      { success: false, error: "Failed to seed team members" },
      { status: 500 }
    )
  }
}
