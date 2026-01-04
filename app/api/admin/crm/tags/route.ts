import { type NextRequest, NextResponse } from "next/server"
import { getSession, isWorkspaceEmail } from "@/app/lib/auth"
import { getDb } from "@/app/lib/firebase-admin"
import { createMailchimpTag } from "@/app/lib/mailchimp-analytics"

// CRM Tags collection name
const TAGS_COLLECTION = "crm_tags"

interface CRMTag {
  id: string
  name: string
  color?: string
  created_at: string
  updated_at: string
}

// Check admin access
async function requireAdmin() {
  const session = await getSession()

  if (!session) {
    return { error: "Unauthorized", status: 401 }
  }

  if (!isWorkspaceEmail(session.email)) {
    return { error: "Forbidden: Workspace email required", status: 403 }
  }

  return { session }
}

// GET - Fetch all CRM tags
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
    const snapshot = await db.collection(TAGS_COLLECTION).orderBy("name", "asc").get()
    
    const tags: CRMTag[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as CRMTag[]

    return NextResponse.json({ success: true, tags })
  } catch (error) {
    console.error("Error fetching CRM tags:", error)
    return NextResponse.json(
      { error: "Failed to fetch tags" },
      { status: 500 }
    )
  }
}

// POST - Create a new CRM tag
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
        { error: "Tag name is required" },
        { status: 400 }
      )
    }

    const tagName = body.name.trim()

    // Check if tag already exists (case-insensitive)
    const db = getDb()
    const existingSnapshot = await db.collection(TAGS_COLLECTION)
      .where("name_lowercase", "==", tagName.toLowerCase())
      .limit(1)
      .get()

    if (!existingSnapshot.empty) {
      // Return existing tag instead of error
      const existingTag = {
        id: existingSnapshot.docs[0].id,
        ...existingSnapshot.docs[0].data(),
      }
      return NextResponse.json({ success: true, tag: existingTag, existed: true })
    }

    // Generate a color based on tag name (for visual distinction)
    const colors = [
      "#3b82f6", // blue
      "#10b981", // emerald
      "#f59e0b", // amber
      "#8b5cf6", // violet
      "#ec4899", // pink
      "#06b6d4", // cyan
      "#f97316", // orange
      "#6366f1", // indigo
    ]
    const colorIndex = tagName.charCodeAt(0) % colors.length
    const color = body.color || colors[colorIndex]

    const now = new Date().toISOString()
    const tagData = {
      name: tagName,
      name_lowercase: tagName.toLowerCase(),
      color,
      created_at: now,
      updated_at: now,
    }

    const docRef = await db.collection(TAGS_COLLECTION).add(tagData)

    const tag: CRMTag = {
      id: docRef.id,
      name: tagName,
      color,
      created_at: now,
      updated_at: now,
    }

    // Also create the tag in Mailchimp (async, don't block the response)
    createMailchimpTag(tagName).catch(err => {
      console.error("Failed to create tag in Mailchimp (non-blocking):", err)
    })

    return NextResponse.json({ success: true, tag, existed: false }, { status: 201 })
  } catch (error) {
    console.error("Error creating CRM tag:", error)
    return NextResponse.json(
      { error: "Failed to create tag" },
      { status: 500 }
    )
  }
}

// DELETE - Delete a CRM tag
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
        { error: "Tag ID is required" },
        { status: 400 }
      )
    }

    const db = getDb()
    await db.collection(TAGS_COLLECTION).doc(id).delete()

    return NextResponse.json({ success: true, message: "Tag deleted" })
  } catch (error) {
    console.error("Error deleting CRM tag:", error)
    return NextResponse.json(
      { error: "Failed to delete tag" },
      { status: 500 }
    )
  }
}
