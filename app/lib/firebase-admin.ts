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
      const credentials = JSON.parse(serviceAccountKey)
      return {
        project_id: credentials.project_id,
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      }
    } catch (error) {
      console.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY:", error)
    }
  }

  // Option 2: Fall back to separate FIREBASE_* variables
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
  
  // Ignore undefined properties when writing documents
  // This is important for Airtable data which may have missing fields
  db.settings({ ignoreUndefinedProperties: true })
  
  return db
}

// Collection names - maps to different Firestore collections
export const COLLECTIONS = {
  EVENTS: "events",
  FEED: "feed",           // THEFEED table
  FEED_8COUNT: "feed_8count",      // 8COUNT table
  FEED_CULTUREDECK: "feed_culturedeck", // CULTUREDECK table
  BLOG_POSTS: "blog_posts",
  BLOG_CATEGORIES: "blog_categories",
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
