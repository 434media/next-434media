import { google } from 'googleapis'
import type { TaskComment } from '../types/crm-types'

interface NotificationData {
  taskId: string
  taskTitle: string
  comment: TaskComment
  mentionedEmails: string[]
  taskUrl?: string
}

interface ServiceAccountCredentials {
  client_email: string
  private_key: string
}

function getCredentials(): ServiceAccountCredentials | null {
  // Use Firebase Admin SDK credentials for Gmail API
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (clientEmail && privateKey) {
    return {
      client_email: clientEmail,
      private_key: privateKey,
    }
  }

  console.error('[Notifications] Firebase credentials not found. Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.')
  return null
}

/**
 * Send email notification to mentioned users via Gmail API
 * Uses domain-wide delegation to send emails as the notification sender
 */
export async function sendCommentNotification(data: NotificationData): Promise<{ success: boolean; error?: string }> {
  const { taskId, taskTitle, comment, mentionedEmails, taskUrl } = data

  if (!mentionedEmails.length) {
    return { success: true } // No one to notify
  }

  const credentials = getCredentials()
  if (!credentials) {
    console.error('[Notifications] No valid credentials found')
    return { success: false, error: 'No valid credentials found' }
  }

  // Get the sender email from environment variable (should be a 434media.com admin)
  const senderEmail = process.env.NOTIFICATION_SENDER_EMAIL || 'notifications@434media.com'
  
  // Filter to only 434media.com emails
  const validRecipients = mentionedEmails.filter(email => 
    email.endsWith('@434media.com')
  )

  if (!validRecipients.length) {
    console.log('[Notifications] No valid 434media.com recipients to notify')
    return { success: true }
  }

  try {
    // Create a JWT client with domain-wide delegation
    const jwtClient = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/gmail.send'],
      subject: senderEmail, // The user to impersonate (requires domain-wide delegation)
    })

    await jwtClient.authorize()

    const gmail = google.gmail({ version: 'v1', auth: jwtClient })

    // Create the email content
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://434media.com'
    const taskLink = taskUrl || `${baseUrl}/admin/crm?task=${taskId}`
    
    const emailSubject = `[434 Media CRM] You were mentioned in: ${taskTitle}`
    const emailBody = `
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #1a1a1a; border-bottom: 2px solid #eee; padding-bottom: 10px;">
      You were mentioned in a comment
    </h2>
    
    <div style="background-color: #f8f9fa; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0; font-weight: bold; color: #333;">
        ${comment.author_name} commented on "${taskTitle}":
      </p>
      <blockquote style="margin: 12px 0; padding: 12px 16px; border-left: 4px solid #4f46e5; background-color: white; border-radius: 4px;">
        ${comment.content.replace(/\n/g, '<br>')}
      </blockquote>
      <p style="margin: 8px 0 0 0; font-size: 12px; color: #666;">
        ${new Date(comment.created_at).toLocaleString('en-US', { 
          dateStyle: 'medium', 
          timeStyle: 'short' 
        })}
      </p>
    </div>
    
    <div style="margin-top: 20px;">
      <a href="${taskLink}" 
         style="display: inline-block; background-color: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
        View Task
      </a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="font-size: 12px; color: #999;">
      This is an automated notification from the 434 Media CRM.
      You received this email because you were mentioned in a task comment.
    </p>
  </div>
</body>
</html>
`

    // Send email to each recipient
    const results = await Promise.allSettled(
      validRecipients.map(async (recipient) => {
        const rawEmail = createRawEmail({
          from: `434 Media CRM <${senderEmail}>`,
          to: recipient,
          subject: emailSubject,
          html: emailBody,
        })

        return gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: rawEmail,
          },
        })
      })
    )

    // Log results
    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected')
    
    if (failed.length > 0) {
      console.error('[Notifications] Some emails failed to send:', 
        failed.map(f => (f as PromiseRejectedResult).reason)
      )
    }

    console.log(`[Notifications] Sent ${successful}/${validRecipients.length} notification emails`)
    
    return { 
      success: successful > 0,
      error: failed.length > 0 ? `${failed.length} emails failed to send` : undefined
    }
  } catch (error) {
    console.error('[Notifications] Failed to send notification:', error)
    
    // If Gmail API fails, fall back to storing notification in Firestore
    // This allows the admin panel to show a notification badge
    await storeNotificationInFirestore(data)
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Create a raw email string for Gmail API
 */
function createRawEmail(params: {
  from: string
  to: string
  subject: string
  html: string
}): string {
  const { from, to, subject, html } = params
  
  const email = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    html,
  ].join('\r\n')

  // Base64 URL encode the email
  return Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Store notification in Firestore as a fallback
 * This allows showing notifications in the admin UI
 */
async function storeNotificationInFirestore(data: NotificationData): Promise<void> {
  try {
    // Dynamic import to avoid circular dependencies
    const { getDb } = await import('./firebase-admin')
    const db = getDb()
    
    const notificationCollection = db.collection('crm_notifications')
    
    await Promise.all(
      data.mentionedEmails
        .filter(email => email.endsWith('@434media.com'))
        .map(async (email) => {
          await notificationCollection.add({
            recipient_email: email,
            type: 'mention',
            task_id: data.taskId,
            task_title: data.taskTitle,
            comment_id: data.comment.id,
            comment_author: data.comment.author_name,
            comment_preview: data.comment.content.substring(0, 100),
            created_at: new Date().toISOString(),
            read: false,
          })
        })
    )
    
    console.log(`[Notifications] Stored ${data.mentionedEmails.length} fallback notifications in Firestore`)
  } catch (error) {
    console.error('[Notifications] Failed to store notification in Firestore:', error)
  }
}

/**
 * Get unread notifications for a user
 */
export async function getUnreadNotifications(email: string): Promise<{
  success: boolean
  notifications: Array<{
    id: string
    type: string
    task_id: string
    task_title: string
    comment_author: string
    comment_preview: string
    created_at: string
    read: boolean
  }>
}> {
  try {
    const { getDb } = await import('./firebase-admin')
    const db = getDb()
    
    const snapshot = await db
      .collection('crm_notifications')
      .where('recipient_email', '==', email)
      .where('read', '==', false)
      .orderBy('created_at', 'desc')
      .limit(20)
      .get()
    
    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Array<{
      id: string
      type: string
      task_id: string
      task_title: string
      comment_author: string
      comment_preview: string
      created_at: string
      read: boolean
    }>
    
    return { success: true, notifications }
  } catch (error) {
    console.error('[Notifications] Failed to get notifications:', error)
    return { success: false, notifications: [] }
  }
}

/**
 * Mark notifications as read
 */
export async function markNotificationsAsRead(notificationIds: string[]): Promise<boolean> {
  try {
    const { getDb } = await import('./firebase-admin')
    const db = getDb()
    
    const batch = db.batch()
    
    notificationIds.forEach(id => {
      const ref = db.collection('crm_notifications').doc(id)
      batch.update(ref, { read: true, read_at: new Date().toISOString() })
    })
    
    await batch.commit()
    return true
  } catch (error) {
    console.error('[Notifications] Failed to mark notifications as read:', error)
    return false
  }
}
