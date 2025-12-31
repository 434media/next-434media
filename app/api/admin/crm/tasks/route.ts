import { type NextRequest, NextResponse } from "next/server"
import { getSession, isWorkspaceEmail } from "@/app/lib/auth"
import {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  getAllTasks,
  completeTask,
} from "@/app/lib/firestore-crm"

// Task owner types
type TaskOwner = "jake" | "pm" | "marc" | "stacy" | "jesse" | "barb" | "teams" | "completed"

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

// Validate owner parameter
function validateOwner(owner: string | null): owner is TaskOwner {
  const validOwners: TaskOwner[] = ["jake", "pm", "marc", "stacy", "jesse", "barb", "teams", "completed"]
  return owner !== null && validOwners.includes(owner as TaskOwner)
}

// GET - Fetch tasks
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const owner = searchParams.get("owner")
    const id = searchParams.get("id")
    const all = searchParams.get("all")

    // Get all tasks across all owners
    if (all === "true") {
      const tasks = await getAllTasks()
      return NextResponse.json({ success: true, tasks })
    }

    // Get single task by ID (requires owner)
    if (id && owner && validateOwner(owner)) {
      const task = await getTaskById(owner, id)
      if (!task) {
        return NextResponse.json(
          { error: "Task not found" },
          { status: 404 }
        )
      }
      return NextResponse.json({ success: true, task })
    }

    // Get tasks by owner
    if (owner && validateOwner(owner)) {
      const tasks = await getTasks(owner)
      return NextResponse.json({ success: true, tasks, owner })
    }

    // If no owner specified, return all tasks
    const tasks = await getAllTasks()
    return NextResponse.json({ success: true, tasks })
  } catch (error) {
    console.error("Error fetching tasks:", error)
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    )
  }
}

// POST - Create a new task
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
    if (!body.title?.trim()) {
      return NextResponse.json(
        { error: "Task title is required" },
        { status: 400 }
      )
    }

    if (!body.owner || !validateOwner(body.owner)) {
      return NextResponse.json(
        { error: "Valid task owner is required (jake, pm, marc, stacy, jesse, barb, teams)" },
        { status: 400 }
      )
    }

    const task = await createTask(body.owner, {
      title: body.title.trim(),
      description: body.description || "",
      assigned_to: body.assigned_to || body.owner,
      assigned_by: body.assigned_by || "",
      status: body.status || "not_started",
      priority: body.priority || "medium",
      due_date: body.due_date || "",
      completed_date: body.completed_date || "",
      client_id: body.client_id || "",
      client_name: body.client_name || "",
      project_id: body.project_id || "",
      opportunity_id: body.opportunity_id || "",
      estimated_hours: body.estimated_hours || 0,
      actual_hours: body.actual_hours || 0,
      notes: body.notes || "",
      tags: body.tags || [],
    })

    return NextResponse.json({ success: true, task }, { status: 201 })
  } catch (error) {
    console.error("Error creating task:", error)
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    )
  }
}

// PUT - Update a task
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = await request.json()

    if (!body.id) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 }
      )
    }

    if (!body.owner || !validateOwner(body.owner)) {
      return NextResponse.json(
        { error: "Valid task owner is required" },
        { status: 400 }
      )
    }

    const { id, owner, ...updates } = body

    // If marking as completed, move to completed collection
    if (updates.status === "completed" && owner !== "completed") {
      const task = await completeTask(owner, id)
      return NextResponse.json({ success: true, task, moved: true })
    }

    const task = await updateTask(owner, id, updates)

    return NextResponse.json({ success: true, task })
  } catch (error) {
    console.error("Error updating task:", error)
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    )
  }
}

// DELETE - Delete a task
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
    const owner = searchParams.get("owner")

    if (!id) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 }
      )
    }

    if (!owner || !validateOwner(owner)) {
      return NextResponse.json(
        { error: "Valid task owner is required" },
        { status: 400 }
      )
    }

    await deleteTask(owner, id)

    return NextResponse.json({ success: true, message: "Task deleted" })
  } catch (error) {
    console.error("Error deleting task:", error)
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    )
  }
}
