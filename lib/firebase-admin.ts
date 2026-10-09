import admin from "firebase-admin"
import { getFirestore } from "firebase-admin/firestore"

// Initialize Firebase Admin SDK
let app: admin.app.App | undefined
let db: admin.firestore.Firestore | undefined

interface ServiceAccountCredentials {
  project_id: string
  client_email: string
  private_key: string
}

/**
 * Parse the service-account key, accepting both shapes it arrives in.
 *
 * Compact single-line JSON, as Vercel stores it, may carry raw newlines inside
 * `private_key` — illegal in JSON, so those are escaped and it is parsed again.
 * A pretty-printed file parses as-is and must not be escaped.
 */
function parseKey(raw: string): Record<string, string> {
  try {
    return JSON.parse(raw) as Record<string, string>
  } catch {
    const escaped = raw.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
    return JSON.parse(escaped) as Record<string, string>
  }
}

function getCredentials(): ServiceAccountCredentials {
  // GOOGLE_SERVICE_ACCOUNT_KEY is the single source of truth for the 434 Media
  // service account — Firestore Admin, GA4, and Search Console all use this key.
  // (Mention notification emails go through Resend, so no other Google
  // credential is needed.)
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!serviceAccountKey) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not set — it is required for Firebase Admin / Firestore.")
  }
  try {
    // Parse as-is first.
    //
    // The sanitize step below escapes every literal newline, which is right for
    // the single-line JSON Vercel stores — there, a raw newline can only be
    // inside the private_key string, where it is illegal and needs escaping.
    //
    // It is wrong for a pretty-printed key file. There the newlines between
    // keys are ordinary JSON whitespace, and escaping them turns `{\n  "type"`
    // into `{\\n  "type"`, which fails at position 1. That is what a service
    // account file downloaded from Google Cloud looks like, so the loader could
    // not read one without the caller compacting it first.
    //
    // So: try the string as given, and only sanitize if that fails. Valid JSON
    // in either shape parses on the first attempt; the escape is reserved for
    // the case it was actually written for.
    const credentials = parseKey(serviceAccountKey)
    return {
      project_id: credentials.project_id,
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    }
  } catch (err) {
    throw new Error(
      `GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
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
 *
 * Binds the database at construction via `getFirestore(app, databaseId)` — the
 * supported multi-database API. The previous approach created a per-database
 * app and retargeted it with `.settings({ databaseId })`, a one-shot that can
 * only run before the instance's first operation; when it threw (e.g. after a
 * dev HMR reset, where the app persists but the instance was already used) the
 * error was swallowed and the instance silently stayed on the `(default)`
 * database. Reads happened to bind correctly while WRITES landed on `(default)`
 * — so deletes/updates/promotions against aimsatx/techday/digitalcanvas
 * succeeded as idempotent no-ops and never persisted.
 */
export function getNamedDb(databaseId: string): admin.firestore.Firestore {
  if (namedDbs[databaseId]) return namedDbs[databaseId]

  // One app for the whole project; getFirestore(app, databaseId) gives a
  // distinct, correctly-bound instance per database — no settings() hack.
  const namedFirestore = getFirestore(
    getFirebaseApp(),
    databaseId,
  ) as unknown as admin.firestore.Firestore

  // Match the default instance's write behavior. Unlike the old code, the
  // databaseId is already bound by getFirestore — if this throws (instance
  // already used) the binding is unaffected, so the swallow is harmless now.
  try {
    namedFirestore.settings({ ignoreUndefinedProperties: true })
  } catch {
    // Settings already applied on this instance — fine.
  }

  namedDbs[databaseId] = namedFirestore
  console.log(`[Firestore] Named database '${databaseId}' initialized`)
  return namedFirestore
}

// Named database IDs (separate databases within the 434 Media GCP project)
export const NAMED_DATABASES = {
  TECHDAY: "techday",
  AIMSATX: "aimsatx",
  // Digital Canvas workshops (e.g. "Lead with Ops. Layer in AI.") — a NAMED
  // database in the 434 Media project. (Historical MHTH registrations once lived
  // in a separate media-analytics-proxy GCP project; they were migrated into the
  // default DB and that external connection was retired.)
  DIGITALCANVAS: "digitalcanvas",
  // VemosVamos newsletter signups live in a named DB; read at READ time and
  // surfaced in the Audiences → Newsletter "VemosVamos" cohort.
  VEMOSVAMOS: "vemosvamos",
} as const

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
  // Audience-side records imported from a partner-shared roster (e.g.
  // Alamo Angels). These live as audience members until explicitly promoted
  // into a Lead — at which point a Lead record is created and the
  // promoted_lead_id backlink is set on this row.
  PARTNER_LIST_MEMBERS: "partner_list_members",
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
