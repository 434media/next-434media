import { type NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { requireAdmin } from "@/lib/auth"
import { appendCohortTaskComment } from "@/lib/firestore-crm"
import type { TaskComment } from "@/types/crm-types"

export const runtime = "nodejs"

// POST — add a comment to a cohort task. Intern-accessible (the board is the
// squad's shared workspace); author + timestamp are stamped server-side.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ success: false, error: "Task id is required" }, { status: 400 })
    const body = await request.json().catch(() => null)
    const content = typeof body?.content === "string" ? body.content.trim() : ""
    if (!content) return NextResponse.json({ success: false, error: "Comment is required" }, { status: 400 })

    const comment: TaskComment = {
      id: randomUUID(),
      content: content.slice(0, 5000),
      author_name: auth.session.name || auth.session.email,
      author_email: auth.session.email,
      created_at: new Date().toISOString(),
    }
    const task = await appendCohortTaskComment(id, comment)
    return NextResponse.json({ success: true, comment, data: task })
  } catch (error) {
    console.error("Error adding cohort-task comment:", error)
    return NextResponse.json({ success: false, error: "Failed to add comment" }, { status: 500 })
  }
}
