import admin from "firebase-admin"

// Initialize Firebase Admin SDK
let app: admin.app.App | undefined
let db: admin.firestore.Firestore | undefined

interface ServiceAccountCredentials {
  project_id: string
  client_email: string
  private_key: string
}

function getCredentials(): ServiceAccountCredentials {
  // Use Firebase-specific environment variables
  // Note: GA_SERVICE_ACCOUNT_KEY is for Google Analytics only and should not be used here
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")

  if (projectId && clientEmail && privateKey) {
    return {
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKey,
    }
  }

  throw new Error(
    "Firebase configuration is missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables."
  )
}

function getFirebaseApp(): admin.app.App {
  if (app) return app

  // Check if app already exists
  if (admin.apps.length > 0) {
    app = admin.apps[0]!
    return app
  }

  const credentials = getCredentials()

  // Initialize new app
  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: credentials.project_id,
      clientEmail: credentials.client_email,
      privateKey: credentials.private_key,
    }),
  })

  console.log("[Firestore] Firebase Admin initialized successfully")
  return app
}

export function getDb(): admin.firestore.Firestore {
  if (db) return db
  
  getFirebaseApp()
  db = admin.firestore()
  
  // Settings can only be called once, before any other operation
  // Using try-catch to handle if already initialized
  try {
    db.settings({ ignoreUndefinedProperties: true })
  } catch {
    // Settings already applied, continue
  }
  
  return db
}

// Collection names - maps to different Firestore collections
export const COLLECTIONS = {
  EVENTS: "events",
  EVENTS_AIMS: "events_aims",  // AIMS ATX events collection
  FEED: "feed",           // THEFEED table
  FEED_8COUNT: "feed_8count",      // 8COUNT table
  FEED_CULTUREDECK: "feed_culturedeck", // CULTUREDECK table
  BLOG_POSTS: "blog_posts",
  BLOG_CATEGORIES: "blog_categories",
  // CRM Collections
  CRM_CLIENTS: "crm_clients",
  CRM_OPPORTUNITIES: "crm_opportunities",
  CRM_PM_RECORDS: "crm_pm_records",
  CRM_BUDGET_VIEW: "crm_budget_view",
  CRM_MASTER_LIST: "crm_master_list",
  CRM_DAILY_SUMMARY: "crm_daily_summary",
  CRM_TASKS_JAKE: "crm_tasks_jake",
  CRM_TASKS_PM: "crm_tasks_pm",
  CRM_TASKS_MARC: "crm_tasks_marc",
  CRM_TASKS_STACY: "crm_tasks_stacy",
  CRM_TASKS_JESSE: "crm_tasks_jesse",
  CRM_TASKS_BARB: "crm_tasks_barb",
  CRM_TASKS_TEAMS: "crm_tasks_teams",
  CRM_TASKS_COMPLETED: "crm_tasks_completed",
  CRM_CLOSED_LOST_LEADS: "crm_closed_lost_leads",
  CRM_CLOSED_WON_LEADS: "crm_closed_won_leads",
  CRM_ARCHIVED_LEADS: "crm_archived_leads",
  CRM_PLATFORMS: "crm_platforms",
  CRM_SALES_REPS: "crm_sales_reps",
  CRM_BARB_PIE_CHART: "crm_barb_pie_chart",
  CRM_PIE_SLICES: "crm_pie_slices",
} as const

// Map table names to Firestore collections
export const TABLE_TO_COLLECTION: Record<string, string> = {
  "THEFEED": COLLECTIONS.FEED,
  "thefeed": COLLECTIONS.FEED,
  "8COUNT": COLLECTIONS.FEED_8COUNT,
  "8count": COLLECTIONS.FEED_8COUNT,
  "CULTUREDECK": COLLECTIONS.FEED_CULTUREDECK,
  "culturedeck": COLLECTIONS.FEED_CULTUREDECK,
} as const

// Test Firestore connection
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    const firestore = getDb()
    await firestore.collection(COLLECTIONS.EVENTS).limit(1).get()
    return true
  } catch (error) {
    console.error("Firestore connection test failed:", error)
    return false
  }
}

// Export admin for type usage
export { admin }
