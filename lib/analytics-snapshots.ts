import { getDb } from "./firebase-admin"

export const GA4_SNAPSHOTS_COLLECTION = "analytics_snapshots_ga4"
export const MAILCHIMP_SNAPSHOTS_COLLECTION = "analytics_snapshots_mailchimp"
export const INSTAGRAM_SNAPSHOTS_COLLECTION = "analytics_snapshots_instagram"

export interface SnapshotMeta {
  snapshotDate: string
  generatedAt: string
}

export interface GA4Snapshot extends SnapshotMeta {
  propertyId: string
  propertyName: string
  range7d: {
    startDate: string
    endDate: string
    summary: Record<string, unknown>
  }
  range30d: {
    startDate: string
    endDate: string
    summary: Record<string, unknown>
    daily: { data: unknown[]; totalPageViews?: number; totalSessions?: number; totalUsers?: number; propertyId?: string }
    topPages: { data: unknown[]; propertyId?: string }
    trafficSources: { data: unknown[]; propertyId?: string }
    devices: { data: unknown[]; propertyId?: string }
    geographic: { data: unknown[]; propertyId?: string }
  }
}

export interface MailchimpSnapshot extends SnapshotMeta {
  audienceId: string
  audienceKey: string
  audienceName: string
  range30d: {
    startDate: string
    endDate: string
    summary: Record<string, unknown>
    campaigns: { data: unknown[] } | Record<string, unknown>
    engagement: { data: unknown[] } | Record<string, unknown>
  }
  range90d: {
    startDate: string
    endDate: string
    growth: { data: unknown[] } | Record<string, unknown>
  }
}

export interface InstagramSnapshot extends SnapshotMeta {
  account: string
  name: string
  instagramBusinessAccountId: string
  profile: Record<string, unknown>
  recentMedia: unknown[]
  accountInsights: unknown
}

async function latestForKey<T>(
  collection: string,
  field: string,
  value: string,
): Promise<T | null> {
  try {
    const db = getDb()
    // Try the indexed query first (where + orderBy)
    try {
      const snap = await db
        .collection(collection)
        .where(field, "==", value)
        .orderBy("snapshotDate", "desc")
        .limit(1)
        .get()
      if (snap.empty) return null
      return snap.docs[0].data() as T
    } catch (queryErr) {
      // Composite index is missing — fall back to a where-only fetch
      // and sort client-side. Slower but always works on day 1 before
      // the index is created.
      const message = queryErr instanceof Error ? queryErr.message : String(queryErr)
      if (message.includes("index") || message.includes("FAILED_PRECONDITION")) {
        console.warn(
          `[analytics-snapshots] Composite index missing on ${collection}; falling back to client-side sort. Create the index for production performance.`,
        )
        const snap = await db.collection(collection).where(field, "==", value).get()
        if (snap.empty) return null
        const docs = snap.docs.map((d) => d.data() as T & { snapshotDate?: string })
        docs.sort((a, b) => (a.snapshotDate ?? "") < (b.snapshotDate ?? "") ? 1 : -1)
        return (docs[0] ?? null) as T | null
      }
      throw queryErr
    }
  } catch (error) {
    console.error(`[analytics-snapshots] Failed to read ${collection} for ${field}=${value}:`, error)
    return null
  }
}

export async function getLatestGA4Snapshot(propertyId: string): Promise<GA4Snapshot | null> {
  return latestForKey<GA4Snapshot>(GA4_SNAPSHOTS_COLLECTION, "propertyId", propertyId)
}

export async function getLatestMailchimpSnapshot(audienceKey: string): Promise<MailchimpSnapshot | null> {
  return latestForKey<MailchimpSnapshot>(MAILCHIMP_SNAPSHOTS_COLLECTION, "audienceKey", audienceKey)
}

export async function getLatestMailchimpSnapshotByAudienceId(
  audienceId: string,
): Promise<MailchimpSnapshot | null> {
  return latestForKey<MailchimpSnapshot>(MAILCHIMP_SNAPSHOTS_COLLECTION, "audienceId", audienceId)
}

export async function getLatestInstagramSnapshot(account: string): Promise<InstagramSnapshot | null> {
  return latestForKey<InstagramSnapshot>(INSTAGRAM_SNAPSHOTS_COLLECTION, "account", account)
}
