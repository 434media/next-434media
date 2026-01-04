import { type NextRequest, NextResponse } from "next/server"
import { getSession, isWorkspaceEmail } from "@/app/lib/auth"
import { 
  sendCommentNotification, 
  getUnreadNotifications, 
  markNotificationsAsRead 
} from "@/app/lib/notifications"

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

// GET - Fetch unread notifications for the current user
export async function GET() {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { session } = authResult
    const result = await getUnreadNotifications(session.email)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching notifications:", error)
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    )
  }
}

// POST - Send a notification for a comment mention
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
    if (!body.taskId || !body.taskTitle || !body.comment || !body.mentionedEmails) {
      return NextResponse.json(
        { error: "Missing required fields: taskId, taskTitle, comment, mentionedEmails" },
        { status: 400 }
      )
    }

    const result = await sendCommentNotification({
      taskId: body.taskId,
      taskTitle: body.taskTitle,
      comment: body.comment,
      mentionedEmails: body.mentionedEmails,
      taskUrl: body.taskUrl,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error sending notification:", error)
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    )
  }
}

// PATCH - Mark notifications as read
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = await request.json()

    if (!body.notificationIds || !Array.isArray(body.notificationIds)) {
      return NextResponse.json(
        { error: "notificationIds array is required" },
        { status: 400 }
      )
    }

    const success = await markNotificationsAsRead(body.notificationIds)
    
    return NextResponse.json({ success })
  } catch (error) {
    console.error("Error marking notifications as read:", error)
    return NextResponse.json(
      { error: "Failed to mark notifications as read" },
      { status: 500 }
    )
  }
}
