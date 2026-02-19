import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  getAllTasks,
  completeTask,
  uncompleteTask,
  getMasterListItemById,
  updateMasterListItem,
  deleteMasterListItem,
} from "@/lib/firestore-crm"

// Task owner types
type TaskOwner = "jake" | "pm" | "marc" | "stacy" | "jesse" | "barb" | "teams" | "completed"

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
      // Social Calendar fields
      is_social_post: body.is_social_post || false,
      social_post_date: body.social_post_date || "",
      social_platforms: body.social_platforms || [],
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

    // Owner map for determining task collection based on assignee
    const ownerMap: Record<string, TaskOwner> = {
      "Jake": "jake",
      "Jacob Lee Miles": "jake",
      "Marc": "marc",
      "Marcos Resendez": "marc",
      "Stacy": "stacy",
      "Stacy Ramirez": "stacy",
      "Jesse": "jesse",
      "Jesse Hernandez": "jesse",
      "Barb": "barb",
      "Barbara Carreon": "barb",
      "Nichole": "teams",
      "Nichole Snow": "teams",
    }

    // STEP 1: Find where the task actually exists
    // Check owner's collection first
    let existingTask = await getTaskById(owner, id)
    let taskSource: "owner_collection" | "completed_collection" | "master_list" | null = null
    
    if (existingTask) {
      taskSource = owner === "completed" ? "completed_collection" : "owner_collection"
    }
    
    // If not found and owner is "completed", the task might be in master list
    if (!existingTask && owner === "completed") {
      const masterListItem = await getMasterListItemById(id)
      if (masterListItem) {
        taskSource = "master_list"
      }
    }
    
    // If still not found, check master list (for any owner)
    if (!taskSource) {
      const masterListItem = await getMasterListItemById(id)
      if (masterListItem) {
        taskSource = "master_list"
      }
    }
    
    // Task not found anywhere
    if (!taskSource) {
      return NextResponse.json(
        { error: "Task not found in any collection" },
        { status: 404 }
      )
    }

    // STEP 2: Handle the update based on task source and requested changes
    
    // Helper function to map task fields to master list fields
    const mapToMasterListUpdates = (taskUpdates: Record<string, unknown>): Record<string, unknown> => {
      const masterListUpdates: Record<string, unknown> = {}
      
      if (taskUpdates.title !== undefined) masterListUpdates.task = taskUpdates.title
      // Map description to the master list's description field (not notes)
      if (taskUpdates.description !== undefined) masterListUpdates.description = taskUpdates.description
      if (taskUpdates.due_date !== undefined) masterListUpdates.task_due_date = taskUpdates.due_date
      if (taskUpdates.status !== undefined) {
        // Map task status back to master list status
        const statusMap: Record<string, string> = {
          not_started: "To Do",
          in_progress: "In Progress", 
          to_do: "To Do",
          ready_for_review: "Ready for Review",
          completed: "Complete",
        }
        masterListUpdates.task_status = statusMap[taskUpdates.status as string] || taskUpdates.status
      }
      if (taskUpdates.priority !== undefined) masterListUpdates.priority = taskUpdates.priority
      if (taskUpdates.notes !== undefined) masterListUpdates.notes = taskUpdates.notes
      if (taskUpdates.tags !== undefined) masterListUpdates.tags = taskUpdates.tags
      if (taskUpdates.web_links !== undefined) {
        // Store as both 'links' (legacy format) and 'web_links' (new format)
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
      if (taskUpdates.disposition !== undefined) {
        masterListUpdates.disposition = taskUpdates.disposition
      }
      if (taskUpdates.doc !== undefined) {
        masterListUpdates.doc = taskUpdates.doc
      }
      // Handle comments - store directly on master list item
      if (taskUpdates.comments !== undefined) {
        masterListUpdates.comments = taskUpdates.comments
      }
      // Handle attachments - store directly on master list item
      if (taskUpdates.attachments !== undefined) {
        masterListUpdates.attachments = taskUpdates.attachments
      }
      // Handle tagged users - store directly on master list item
      if (taskUpdates.tagged_users !== undefined) {
        masterListUpdates.tagged_users = taskUpdates.tagged_users
      }
      // Handle client fields - store directly on master list item
      if (taskUpdates.client_id !== undefined) {
        masterListUpdates.client_id = taskUpdates.client_id
      }
      if (taskUpdates.client_name !== undefined) {
        masterListUpdates.client_name = taskUpdates.client_name
      }
      // Handle social calendar fields
      if (taskUpdates.is_social_post !== undefined) {
        masterListUpdates.is_social_post = taskUpdates.is_social_post
      }
      if (taskUpdates.social_post_date !== undefined) {
        masterListUpdates.social_post_date = taskUpdates.social_post_date
      }
      if (taskUpdates.social_platforms !== undefined) {
        masterListUpdates.social_platforms = taskUpdates.social_platforms
      }
      
      return masterListUpdates
    }

    // Handle MASTER LIST tasks
    if (taskSource === "master_list") {
      const masterListUpdates = mapToMasterListUpdates(updates)
      await updateMasterListItem(id, masterListUpdates)
      
      return NextResponse.json({ 
        success: true, 
        task: { id, ...updates },
        source: "master_list"
      })
    }

    // Handle COMPLETED COLLECTION tasks being reactivated
    if (taskSource === "completed_collection" && updates.status && updates.status !== "completed") {
      const assignedTo = updates.assigned_to || existingTask?.assigned_to || ""
      const newOwner: TaskOwner = ownerMap[assignedTo] || "teams"
      
      const task = await uncompleteTask(id, newOwner, updates.status)
      return NextResponse.json({ success: true, task, reactivated: true })
    }

    // Handle OWNER COLLECTION tasks being marked as completed
    if (taskSource === "owner_collection" && updates.status === "completed") {
      const task = await completeTask(owner, id)
      return NextResponse.json({ success: true, task, moved: true })
    }

    // Handle regular updates to owner collection or completed collection
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

    // First, check where the task actually exists
    // Check owner's collection first
    const existingTask = await getTaskById(owner, id)
    
    if (existingTask) {
      // Task exists in owner's collection, delete it there
      await deleteTask(owner, id)
      return NextResponse.json({ success: true, message: "Task deleted" })
    }
    
    // Task not found in owner's collection, check master list
    const masterListItem = await getMasterListItemById(id)
    
    if (masterListItem) {
      // Task is from master list, delete it there
      await deleteMasterListItem(id)
      return NextResponse.json({ success: true, message: "Task deleted", source: "master_list" })
    }
    
    // Task not found anywhere - still return success since the end result is the same
    // (task doesn't exist)
    console.log(`Task ${id} not found in any collection, treating as already deleted`)
    return NextResponse.json({ success: true, message: "Task deleted" })
    
  } catch (error) {
    console.error("Error deleting task:", error)
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    )
  }
}
