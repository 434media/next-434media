import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import {
  getUnifiedTasks,
  getUnifiedTaskById,
  createUnifiedTask,
  updateUnifiedTask,
  deleteUnifiedTask,
  completeUnifiedTask,
  uncompleteUnifiedTask,
  getMasterListItemById,
  updateMasterListItem,
  deleteMasterListItem,
} from "@/lib/firestore-crm"

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

// GET — fetch tasks. Filters: ?id=, ?assignee=, ?status=, ?brand=
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (id) {
      const task = await getUnifiedTaskById(id)
      if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 })
      return NextResponse.json({ success: true, task })
    }

    const tasks = await getUnifiedTasks({
      assignee: searchParams.get("assignee") || undefined,
      status: searchParams.get("status") || undefined,
      brand: searchParams.get("brand") || undefined,
      client_id: searchParams.get("client_id") || undefined,
      opportunity_id: searchParams.get("opportunity_id") || undefined,
    })
    return NextResponse.json({ success: true, tasks })
  } catch (error) {
    console.error("Error fetching tasks:", error)
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
  }
}

// POST — create a task. `assigned_to` is required; `owner` is no longer needed.
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Task title is required" }, { status: 400 })
    }

    const task = await createUnifiedTask({
      title: body.title.trim(),
      description: body.description || "",
      assigned_to: body.assigned_to || "Unassigned",
      secondary_assigned_to: body.secondary_assigned_to || [],
      assigned_by: body.assigned_by || "",
      created_by: body.created_by || "",
      brand: body.brand || undefined,
      status: body.status || "not_started",
      priority: body.priority || "medium",
      due_date: body.due_date || "",
      completed_date: body.completed_date || "",
      client_id: body.client_id || "",
      client_name: body.client_name || "",
      project_id: body.project_id || "",
      opportunity_id: body.opportunity_id || "",
      is_opportunity: body.is_opportunity || false,
      disposition: body.disposition || undefined,
      doc: body.doc || undefined,
      estimated_hours: body.estimated_hours || 0,
      actual_hours: body.actual_hours || 0,
      notes: body.notes || "",
      tags: body.tags || [],
      web_links: body.web_links || [],
      attachments: body.attachments || [],
      comments: body.comments || [],
      tagged_users: body.tagged_users || [],
      is_social_post: body.is_social_post || false,
      social_post_date: body.social_post_date || "",
      social_platforms: body.social_platforms || [],
    })

    return NextResponse.json({ success: true, task, id: task.id }, { status: 201 })
  } catch (error) {
    console.error("Error creating task:", error)
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 })
  }
}

// PUT — update a task. `id` is required; `owner` is ignored.
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    if (!body.id) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 })
    }

    const { id, owner: _owner, ...updates } = body
    void _owner // legacy field, ignored

    // First check master list (legacy data source). Master-list-derived tasks
    // get persisted back to the master list, not the unified collection.
    const masterListItem = await getMasterListItemById(id)
    if (masterListItem) {
      const masterListUpdates = mapToMasterListUpdates(updates)
      await updateMasterListItem(id, masterListUpdates)
      return NextResponse.json({
        success: true,
        task: { id, ...updates },
        source: "master_list",
      })
    }

    // Status transition shortcuts
    if (updates.status === "completed") {
      const task = await completeUnifiedTask(id)
      return NextResponse.json({ success: true, task, completed: true })
    }
    // Reactivating from completed → just flip status
    if (typeof updates.status === "string" && updates.status !== "completed") {
      const existing = await getUnifiedTaskById(id)
      if (existing?.status === "completed") {
        const task = await uncompleteUnifiedTask(id, updates.status)
        return NextResponse.json({ success: true, task, reactivated: true })
      }
    }

    const task = await updateUnifiedTask(id, updates)
    return NextResponse.json({ success: true, task })
  } catch (error) {
    console.error("Error updating task:", error)
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 })
  }
}

// DELETE — delete a task by id. `owner` is ignored.
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 })
    }

    // Check master list first
    const masterListItem = await getMasterListItemById(id)
    if (masterListItem) {
      await deleteMasterListItem(id)
      return NextResponse.json({ success: true, message: "Task deleted", source: "master_list" })
    }

    try {
      await deleteUnifiedTask(id)
    } catch (err) {
      // Idempotent — if the task doesn't exist anywhere, succeed silently
      console.log(`[Tasks API] Task ${id} not found, treating as already deleted:`, err)
    }
    return NextResponse.json({ success: true, message: "Task deleted" })
  } catch (error) {
    console.error("Error deleting task:", error)
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 })
  }
}

// Map task fields back to master-list field names (for tasks that originated
// in the legacy master_list collection).
function mapToMasterListUpdates(taskUpdates: Record<string, unknown>): Record<string, unknown> {
  const masterListUpdates: Record<string, unknown> = {}
  if (taskUpdates.title !== undefined) masterListUpdates.task = taskUpdates.title
  if (taskUpdates.description !== undefined) masterListUpdates.description = taskUpdates.description
  if (taskUpdates.due_date !== undefined) masterListUpdates.task_due_date = taskUpdates.due_date
  if (taskUpdates.status !== undefined) {
    const statusMap: Record<string, string> = {
      not_started: "To Do",
      in_progress: "In Progress",
      to_do: "To Do",
      ready_for_review: "Ready for Review",
      completed: "Complete",
    }
    masterListUpdates.task_status =
      statusMap[taskUpdates.status as string] || taskUpdates.status
  }
  if (taskUpdates.priority !== undefined) masterListUpdates.priority = taskUpdates.priority
  if (taskUpdates.notes !== undefined) masterListUpdates.notes = taskUpdates.notes
  if (taskUpdates.tags !== undefined) masterListUpdates.tags = taskUpdates.tags
  if (taskUpdates.web_links !== undefined) {
    masterListUpdates.links = Array.isArray(taskUpdates.web_links)
      ? (taskUpdates.web_links as string[]).join("\n")
      : taskUpdates.web_links
    masterListUpdates.web_links = taskUpdates.web_links
  }
  if (taskUpdates.assigned_to !== undefined) {
    masterListUpdates.assignee = [{ name: taskUpdates.assigned_to }]
  }
  if (taskUpdates.secondary_assigned_to !== undefined) {
    masterListUpdates.secondary_assigned_to = taskUpdates.secondary_assigned_to
  }
  if (taskUpdates.brand !== undefined) {
    masterListUpdates.team = taskUpdates.brand ? [taskUpdates.brand] : []
  }
  if (taskUpdates.is_opportunity !== undefined) {
    masterListUpdates.is_opportunity = taskUpdates.is_opportunity
  }
  if (taskUpdates.disposition !== undefined) masterListUpdates.disposition = taskUpdates.disposition
  if (taskUpdates.doc !== undefined) masterListUpdates.doc = taskUpdates.doc
  if (taskUpdates.comments !== undefined) masterListUpdates.comments = taskUpdates.comments
  if (taskUpdates.attachments !== undefined) masterListUpdates.attachments = taskUpdates.attachments
  if (taskUpdates.tagged_users !== undefined) masterListUpdates.tagged_users = taskUpdates.tagged_users
  if (taskUpdates.client_id !== undefined) masterListUpdates.client_id = taskUpdates.client_id
  if (taskUpdates.client_name !== undefined) masterListUpdates.client_name = taskUpdates.client_name
  if (taskUpdates.is_social_post !== undefined) masterListUpdates.is_social_post = taskUpdates.is_social_post
  if (taskUpdates.social_post_date !== undefined) masterListUpdates.social_post_date = taskUpdates.social_post_date
  if (taskUpdates.social_platforms !== undefined) masterListUpdates.social_platforms = taskUpdates.social_platforms
  return masterListUpdates
}
