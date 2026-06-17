import { type NextRequest, NextResponse } from "next/server"
import { requireFullAdmin } from "@/lib/auth"
import {
  getCohortTasksByCohort,
  createCohortTask,
  updateCohortTask,
  deleteCohortTask,
} from "@/lib/firestore-crm"
import type { CohortTask } from "@/types/crm-types"

export const runtime = "nodejs"

// Squad-grouped cohort board (Section 3). Operator-managed for v1 (full_admin+).
// Intern self-service (view + status update on own tasks) is a planned follow-up.

const VALID_SQUADS = ["domain", "build", "story_media", "gtm", "analytics"]
const VALID_STATUSES = ["not_started", "in_progress", "completed", "blocked", "deferred"]
const VALID_PRIORITIES = ["low", "medium", "high", "urgent"]

// GET — tasks for a cohort (?cohortId=)
export async function GET(request: NextRequest) {
  const auth = await requireFullAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const cohortId = new URL(request.url).searchParams.get("cohortId")
    if (!cohortId) return NextResponse.json({ success: false, error: "cohortId is required" }, { status: 400 })
    const tasks = await getCohortTasksByCohort(cohortId)
    return NextResponse.json({ success: true, data: tasks })
  } catch (error) {
    console.error("Error fetching cohort tasks:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch cohort tasks" }, { status: 500 })
  }
}

// POST — create a cohort task
export async function POST(request: NextRequest) {
  const auth = await requireFullAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const body = await request.json()
    const { cohortId, squad, title, status, priority } = body as Partial<CohortTask>

    if (!cohortId) return NextResponse.json({ success: false, error: "cohortId is required" }, { status: 400 })
    if (!squad || !VALID_SQUADS.includes(squad))
      return NextResponse.json({ success: false, error: "Valid squad is required" }, { status: 400 })
    if (!title?.trim()) return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 })
    if (status && !VALID_STATUSES.includes(status))
      return NextResponse.json({ success: false, error: `Invalid status: ${status}` }, { status: 400 })
    if (priority && !VALID_PRIORITIES.includes(priority))
      return NextResponse.json({ success: false, error: `Invalid priority: ${priority}` }, { status: 400 })

    const task = await createCohortTask({
      cohortId,
      squad,
      title: title.trim(),
      status: status ?? "not_started",
      priority: priority ?? undefined,
      week: typeof body.week === "number" ? body.week : undefined,
      isDeliverable: body.isDeliverable === true ? true : undefined,
      assigned_to: body.assigned_to?.trim() || undefined,
      description: body.description?.trim() || undefined,
      due_date: body.due_date || undefined,
      created_by: auth.session.email,
    })
    return NextResponse.json({ success: true, data: task })
  } catch (error) {
    console.error("Error creating cohort task:", error)
    return NextResponse.json({ success: false, error: "Failed to create cohort task" }, { status: 500 })
  }
}

// PATCH — update a cohort task (body.id + changed fields)
export async function PATCH(request: NextRequest) {
  const auth = await requireFullAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const body = await request.json()
    const { id } = body as { id?: string }
    if (!id) return NextResponse.json({ success: false, error: "Task id is required" }, { status: 400 })

    const updates: Partial<CohortTask> = {}
    if (body.title !== undefined) updates.title = String(body.title).trim()
    if (body.description !== undefined) updates.description = String(body.description).trim()
    if (body.assigned_to !== undefined) updates.assigned_to = String(body.assigned_to).trim()
    if (body.due_date !== undefined) updates.due_date = body.due_date || undefined
    if (body.week !== undefined) updates.week = typeof body.week === "number" ? body.week : undefined
    if (body.isDeliverable !== undefined) updates.isDeliverable = body.isDeliverable === true
    if (body.squad !== undefined) {
      if (!VALID_SQUADS.includes(body.squad))
        return NextResponse.json({ success: false, error: `Invalid squad: ${body.squad}` }, { status: 400 })
      updates.squad = body.squad
    }
    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status))
        return NextResponse.json({ success: false, error: `Invalid status: ${body.status}` }, { status: 400 })
      updates.status = body.status
    }
    if (body.priority !== undefined) {
      if (body.priority && !VALID_PRIORITIES.includes(body.priority))
        return NextResponse.json({ success: false, error: `Invalid priority: ${body.priority}` }, { status: 400 })
      updates.priority = body.priority || undefined
    }

    const task = await updateCohortTask(id, updates)
    return NextResponse.json({ success: true, data: task })
  } catch (error) {
    console.error("Error updating cohort task:", error)
    return NextResponse.json({ success: false, error: "Failed to update cohort task" }, { status: 500 })
  }
}

// DELETE — remove a cohort task (?id=)
export async function DELETE(request: NextRequest) {
  const auth = await requireFullAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const id = new URL(request.url).searchParams.get("id")
    if (!id) return NextResponse.json({ success: false, error: "Task id is required" }, { status: 400 })
    await deleteCohortTask(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting cohort task:", error)
    return NextResponse.json({ success: false, error: "Failed to delete cohort task" }, { status: 500 })
  }
}
