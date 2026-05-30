import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin, isCrmSuperAdmin } from "@/lib/auth"
import { getContentPostById, updateContentPost } from "@/lib/firestore-crm"
import { sendCommentNotification } from "@/lib/notifications"
import { TEAM_MEMBERS } from "@/components/crm/types"
import type {
  ContentApproval,
  ContentPostStatus,
  TaskComment,
} from "@/components/crm/types"

// POST /api/admin/crm/content-posts/[id]/decision
// Body: { decision: "approved" | "rejected", note?: string }
//
// Phase 2 of the content approve/reject pipeline. Records a reviewer decision:
//   - flips status to "approved" or "rejected"
//   - appends a ContentApproval to approvals[] (the audit trail)
//   - writes a decision comment into the existing comments[] thread
//   - notifies the post's assignee (post.user) via the existing notification path
//
// Gated to super-admins only (decision made with Jesse): producers can submit
// for approval, but only crm_super_admin can approve/reject. A reject requires
// a note so the assignee knows what to fix.

export const runtime = "nodejs"

interface DecisionBody {
  decision?: "approved" | "rejected"
  note?: string
}

// Resolve a content post's assignee (a display name like "Jesse Hernandez") to
// an email so we can notify them. Static TEAM_MEMBERS is the canonical name↔email
// map and matches the names used elsewhere in the CRM.
function resolveAssigneeEmail(userName: string | undefined): string | null {
  if (!userName) return null
  const trimmed = userName.trim().toLowerCase()
  const match = TEAM_MEMBERS.find(
    (m) => m.name.toLowerCase() === trimmed || m.name.split(" ")[0].toLowerCase() === trimmed,
  )
  return match?.email ?? null
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isAuthorizedAdmin(session.email)) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
  }
  // Approve/reject is super-admin only.
  if (!(await isCrmSuperAdmin(session.email))) {
    return NextResponse.json(
      { error: "Forbidden: Only super admins can approve or reject content" },
      { status: 403 },
    )
  }

  const { id } = await ctx.params

  let body: DecisionBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const decision = body.decision
  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json(
      { error: '`decision` must be "approved" or "rejected"' },
      { status: 400 },
    )
  }
  const note = typeof body.note === "string" ? body.note.trim() : ""
  if (decision === "rejected" && !note) {
    return NextResponse.json(
      { error: "A note is required when rejecting — tell the assignee what to change" },
      { status: 400 },
    )
  }

  const post = await getContentPostById(id)
  if (!post) {
    return NextResponse.json({ error: "Content post not found" }, { status: 404 })
  }

  const now = new Date().toISOString()
  const reviewerName = session.name?.trim() || session.email

  // 1) Audit record
  const approval: ContentApproval = {
    decision,
    by_name: reviewerName,
    by_email: session.email,
    note: note || undefined,
    at: now,
  }

  // 2) Decision comment in the shared thread — surfaces the call in the
  //    conversation the assignee already reads. Mention the assignee so the
  //    existing notification path lights them up.
  const assigneeEmail = resolveAssigneeEmail(post.user)
  const verb = decision === "approved" ? "approved" : "requested changes on"
  const comment: TaskComment = {
    id: crypto.randomUUID(),
    content: `${reviewerName} ${verb} this post${note ? `: ${note}` : "."}`,
    author_name: reviewerName,
    author_email: session.email,
    created_at: now,
    mentions: assigneeEmail ? [assigneeEmail] : [],
  }

  const nextStatus: ContentPostStatus = decision
  try {
    await updateContentPost(id, {
      status: nextStatus,
      approvals: [...(post.approvals ?? []), approval],
      comments: [...(post.comments ?? []), comment],
    })
  } catch (err) {
    console.error(`[content decision ${id}] update failed:`, err)
    return NextResponse.json({ error: "Failed to record decision" }, { status: 500 })
  }

  // 3) Notify the assignee — best-effort, never fails the decision.
  let notified = false
  if (assigneeEmail && assigneeEmail !== session.email) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://434media.com"
      const result = await sendCommentNotification({
        taskId: id,
        taskTitle: post.title || "Content Post",
        comment,
        mentionedEmails: [assigneeEmail],
        taskUrl: `${baseUrl}/admin/content?openContent=${encodeURIComponent(id)}`,
        isContentPost: true,
      })
      notified = result.success
    } catch (err) {
      console.error(`[content decision ${id}] notify failed:`, err)
    }
  }

  return NextResponse.json({ success: true, status: nextStatus, approval, notified })
}
