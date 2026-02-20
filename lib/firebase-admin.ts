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
  // Option 1: Use the same GOOGLE_SERVICE_ACCOUNT_KEY as analytics (full JSON)
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (serviceAccountKey) {
    try {
      // Sanitize control characters (e.g. literal newlines in the private_key field)
      const sanitized = serviceAccountKey.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
      const credentials = JSON.parse(sanitized)
      return {
        project_id: credentials.project_id,
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      }
    } catch {
      // GOOGLE_SERVICE_ACCOUNT_KEY is malformed — will fall back to separate FIREBASE_* env vars
    }
  }

  // Option 2: Fall back to separate FIREBASE_* variables
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  let privateKey = process.env.FIREBASE_PRIVATE_KEY

  if (projectId && clientEmail && privateKey) {
    // Handle common private key encoding issues:
    // 1. Literal \n strings that need to be real newlines
    privateKey = privateKey.replace(/\\n/g, "\n")
    // 2. Remove surrounding quotes if env var was double-quoted
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1).replace(/\\n/g, "\n")
    }
    
    return {
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKey,
    }
  }

  throw new Error(
    "Firebase configuration is missing. Set either GOOGLE_SERVICE_ACCOUNT_KEY (JSON) or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY"
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

// Named database instances cache
const namedDbs: Record<string, admin.firestore.Firestore> = {}

/**
 * Get a Firestore instance for a named database (e.g., "techday", "aimsatx")
 * These are separate databases within the same GCP project.
 */
export function getNamedDb(databaseId: string): admin.firestore.Firestore {
  if (namedDbs[databaseId]) return namedDbs[databaseId]

  const appName = `named-db-${databaseId}`
  let namedApp: admin.app.App

  // Check if this named app already exists
  const existing = admin.apps.find((a) => a?.name === appName)
  if (existing) {
    namedApp = existing
  } else {
    const credentials = getCredentials()
    namedApp = admin.initializeApp(
      {
        credential: admin.credential.cert({
          projectId: credentials.project_id,
          clientEmail: credentials.client_email,
          privateKey: credentials.private_key,
        }),
      },
      appName
    )
  }

  const namedFirestore = namedApp.firestore()
  try {
    namedFirestore.settings({ databaseId, ignoreUndefinedProperties: true })
  } catch {
    // Settings already applied
  }

  namedDbs[databaseId] = namedFirestore
  console.log(`[Firestore] Named database '${databaseId}' initialized`)
  return namedFirestore
}

// Named database IDs
export const NAMED_DATABASES = {
  TECHDAY: "techday",
  AIMSATX: "aimsatx",
} as const

// ── External project: Digital Canvas (media-analytics-proxy) ──
// The Digital Canvas site writes MHTH event registrations to its own
// GCP project ("media-analytics-proxy") instead of the 434 Media project.
// We connect to it as a separate Firebase app to read those registrations.
let digitalCanvasDb: admin.firestore.Firestore | undefined

export function getDigitalCanvasDb(): admin.firestore.Firestore {
  if (digitalCanvasDb) return digitalCanvasDb

  const appName = "digitalcanvas"

  // Check if app already exists
  const existing = admin.apps.find((a) => a?.name === appName)
  if (existing) {
    digitalCanvasDb = existing.firestore()
    return digitalCanvasDb
  }

  const raw = process.env.DIGITALCANVAS_SERVICE_ACCOUNT_KEY
  if (!raw) {
    throw new Error(
      "DIGITALCANVAS_SERVICE_ACCOUNT_KEY is not set. Cannot connect to Digital Canvas Firestore."
    )
  }

  // Sanitize control characters (e.g. literal newlines in the private_key field)
  const sanitized = raw.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
  const creds = JSON.parse(sanitized)
  const dcApp = admin.initializeApp(
    {
      credential: admin.credential.cert({
        projectId: creds.project_id,
        clientEmail: creds.client_email,
        privateKey: creds.private_key,
      }),
    },
    appName
  )

  digitalCanvasDb = dcApp.firestore()
  try {
    digitalCanvasDb.settings({ ignoreUndefinedProperties: true })
  } catch {
    // Settings already applied
  }

  console.log("[Firestore] Digital Canvas project (media-analytics-proxy) initialized")
  return digitalCanvasDb
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
  // Project Management Collections
  PM_EVENTS: "pm_events",
  PM_VENDORS: "pm_vendors",
  PM_SPEAKERS: "pm_speakers",
  PM_SOPS: "pm_sops",
  // Contact Form & Email Collections
  CONTACT_FORMS: "contact_forms",
  EMAIL_SIGNUPS: "email_signups",
  EVENT_REGISTRATIONS: "event_registrations",
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

// Verify Firebase ID token for authentication
export async function verifyFirebaseToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
  const app = getFirebaseApp()
  const auth = admin.auth(app)
  return auth.verifyIdToken(idToken)
}

// Export admin for type usage
export { admin }
