import { type NextRequest, NextResponse } from "next/server"
import { getSession, isWorkspaceEmail } from "@/app/lib/auth"

// Debug endpoint to test notifications and create test notifications
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session || !isWorkspaceEmail(session.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { getDb } = await import("@/app/lib/firebase-admin")
    const db = getDb()

    const normalizedEmail = session.email.toLowerCase()
    
    console.log(`[Notifications Debug] Checking notifications for: ${normalizedEmail}`)

    // Get all notifications for this user (both read and unread)
    let allNotifications
    try {
      allNotifications = await db
        .collection("crm_notifications")
        .where("recipient_email", "==", normalizedEmail)
        .limit(50)
        .get()
    } catch (e) {
      console.error("[Notifications Debug] Error fetching all notifications:", e)
      allNotifications = { docs: [] }
    }

    // Get unread only
    let unreadNotifications
    try {
      unreadNotifications = await db
        .collection("crm_notifications")
        .where("recipient_email", "==", normalizedEmail)
        .where("read", "==", false)
        .limit(20)
        .get()
    } catch (e) {
      console.error("[Notifications Debug] Error fetching unread notifications:", e)
      unreadNotifications = { docs: [] }
    }

    // Get a sample of all notifications in the collection for debugging
    let sampleNotifications
    try {
      sampleNotifications = await db
        .collection("crm_notifications")
        .limit(10)
        .get()
    } catch (e) {
      console.error("[Notifications Debug] Error fetching sample notifications:", e)
      sampleNotifications = { docs: [] }
    }

    // Get unique recipient emails from sample to see what emails are being used
    const uniqueRecipients = [...new Set(
      sampleNotifications.docs.map(doc => doc.data().recipient_email)
    )]

    return NextResponse.json({
      success: true,
      debug_info: {
        session_email: session.email,
        normalized_email: normalizedEmail,
        timestamp: new Date().toISOString(),
      },
      stats: {
        total_for_user: allNotifications.docs.length,
        unread_for_user: unreadNotifications.docs.length,
        sample_collection_size: sampleNotifications.docs.length,
      },
      unique_recipients_in_sample: uniqueRecipients,
      unread_notifications: unreadNotifications.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })),
      all_notifications_for_user: allNotifications.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })),
      sample_from_collection: sampleNotifications.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })),
    })
  } catch (error) {
    console.error("[Notifications Debug] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to debug notifications",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// POST - Create a test notification for the current user
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session || !isWorkspaceEmail(session.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { getDb } = await import("@/app/lib/firebase-admin")
    const db = getDb()

    const normalizedEmail = session.email.toLowerCase()

    // Create a test notification
    const testNotification = {
      recipient_email: normalizedEmail,
      type: "assignment",
      task_id: "test-" + Date.now(),
      task_title: "Test Notification - " + new Date().toLocaleTimeString(),
      assigned_by: "System Test",
      created_at: new Date().toISOString(),
      read: false,
    }

    const docRef = await db.collection("crm_notifications").add(testNotification)

    return NextResponse.json({
      success: true,
      message: "Test notification created",
      notification_id: docRef.id,
      notification: testNotification,
    })
  } catch (error) {
    console.error("Error creating test notification:", error)
    return NextResponse.json(
      {
        error: "Failed to create test notification",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
