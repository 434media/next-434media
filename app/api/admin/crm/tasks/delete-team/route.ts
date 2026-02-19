import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { deleteAllTasksFromOwner } from "@/lib/firestore-crm"

// Check admin access
async function requireAdmin() {
  const session = await getSession()

  if (!session) {
    return { error: "Unauthorized", status: 401 }
  }

  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Workspace email required", status: 403 }
  }

  return { session }
}

// DELETE - Delete all tasks assigned to "teams"
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const deletedCount = await deleteAllTasksFromOwner("teams")

    return NextResponse.json({ 
      success: true, 
      message: `Deleted ${deletedCount} team tasks`,
      deletedCount 
    })
  } catch (error) {
    console.error("Error deleting team tasks:", error)
    return NextResponse.json(
      { error: "Failed to delete team tasks" },
      { status: 500 }
    )
  }
}
