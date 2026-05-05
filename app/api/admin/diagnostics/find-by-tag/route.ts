import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import {
  getDb,
  getNamedDb,
  getDigitalCanvasDb,
  COLLECTIONS,
  NAMED_DATABASES,
} from "@/lib/firebase-admin"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * Diagnostic — search every captured-data collection for a substring match
 * against tags / event / source / eventName fields. Used for one-off
 * archaeology when populating event-role overlays (e.g., "find every email
 * tagged with mxr" before drafting role lists for MXR at Main).
 *
 * Read-only. Returns up to 500 matches across all collections, deduped by
 * email + collection so the same row doesn't appear twice.
 *
 * Usage:
 *   GET /api/admin/diagnostics/find-by-tag?q=mxr
 *   GET /api/admin/diagnostics/find-by-tag?q=tx-media-summit&limit=200
 *
 * Query params:
 *   - q (required) — case-insensitive substring matched against:
 *       tags[], event, eventName, source, sourceSite
 *   - limit (optional) — cap total matches (default 500, hard max 2000)
 *   - collections (optional, csv) — restrict to: email_signups, contact_forms,
 *       event_registrations, leads. Default: all four.
 */

interface MatchRow {
  collection: string
  dbSource: string
  id: string
  email: string
  name?: string
  company?: string
  tags?: string[]
  event?: string
  eventName?: string
  source?: string
  sourceSite?: string
  matchedField: string
  createdAt?: string
}

interface FindByTagResponse {
  query: string
  totalMatches: number
  truncated: boolean
  byCollection: Record<string, number>
  byDbSource: Record<string, number>
  uniqueEmails: number
  matches: MatchRow[]
}

const VALID_COLLECTIONS = new Set([
  "email_signups",
  "contact_forms",
  "event_registrations",
  "leads",
])

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

function matchesQuery(row: Record<string, unknown>, q: string): string | null {
  const tags = Array.isArray(row.tags) ? (row.tags as unknown[]) : []
  for (const t of tags) {
    if (typeof t === "string" && t.toLowerCase().includes(q)) return `tag:${t}`
  }
  for (const field of ["event", "eventName", "source", "sourceSite"]) {
    const v = row[field]
    if (typeof v === "string" && v.toLowerCase().includes(q)) {
      return `${field}:${v}`
    }
  }
  return null
}

function timestampToIso(value: unknown): string | undefined {
  if (!value) return undefined
  if (typeof value === "string") return value
  if (typeof value === "object") {
    const v = value as { _seconds?: number; seconds?: number }
    const s = v._seconds ?? v.seconds
    if (typeof s === "number") return new Date(s * 1000).toISOString()
  }
  return undefined
}

async function searchCollection(
  db: FirebaseFirestore.Firestore,
  collection: string,
  dbSource: string,
  q: string,
  limit: number,
): Promise<MatchRow[]> {
  const out: MatchRow[] = []
  try {
    const snapshot = await db.collection(collection).get()
    for (const doc of snapshot.docs) {
      if (out.length >= limit) break
      const data = doc.data() as Record<string, unknown>
      const matchedField = matchesQuery(data, q)
      if (!matchedField) continue
      out.push({
        collection,
        dbSource,
        id: doc.id,
        email: typeof data.email === "string" ? data.email : "",
        name:
          typeof data.name === "string"
            ? data.name
            : `${(data.firstName as string) || ""} ${(data.lastName as string) || ""}`.trim() ||
              undefined,
        company: typeof data.company === "string" ? data.company : undefined,
        tags: Array.isArray(data.tags) ? (data.tags as string[]) : undefined,
        event: typeof data.event === "string" ? data.event : undefined,
        eventName: typeof data.eventName === "string" ? data.eventName : undefined,
        source: typeof data.source === "string" ? data.source : undefined,
        sourceSite: typeof data.sourceSite === "string" ? data.sourceSite : undefined,
        matchedField,
        createdAt:
          timestampToIso(data.created_at) ??
          timestampToIso(data.createdAt) ??
          timestampToIso(data.registeredAt) ??
          undefined,
      })
    }
  } catch (err) {
    console.warn(
      `[find-by-tag] failed to scan ${dbSource}/${collection}:`,
      err instanceof Error ? err.message : err,
    )
  }
  return out
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get("q") ?? "").trim().toLowerCase()
  if (!q) {
    return NextResponse.json(
      { error: "Required: ?q=<substring>. Example: ?q=mxr" },
      { status: 400 },
    )
  }

  const requestedLimit = Number(searchParams.get("limit") ?? 500)
  const limit = Math.min(Math.max(1, isFinite(requestedLimit) ? requestedLimit : 500), 2000)

  const collectionsParam = searchParams.get("collections")
  const requestedCollections = collectionsParam
    ? collectionsParam.split(",").map((s) => s.trim()).filter((c) => VALID_COLLECTIONS.has(c))
    : Array.from(VALID_COLLECTIONS)

  const all: MatchRow[] = []

  // Default DB
  const defaultDb = getDb()
  if (requestedCollections.includes("email_signups")) {
    all.push(...(await searchCollection(defaultDb, COLLECTIONS.EMAIL_SIGNUPS, "default", q, limit)))
  }
  if (requestedCollections.includes("contact_forms")) {
    all.push(...(await searchCollection(defaultDb, COLLECTIONS.CONTACT_FORMS, "default", q, limit)))
  }
  if (requestedCollections.includes("event_registrations")) {
    all.push(
      ...(await searchCollection(defaultDb, COLLECTIONS.EVENT_REGISTRATIONS, "default", q, limit)),
    )
  }
  if (requestedCollections.includes("leads")) {
    all.push(...(await searchCollection(defaultDb, "leads", "default", q, limit)))
  }

  // Named DBs
  if (requestedCollections.includes("email_signups")) {
    try {
      const aimsatx = getNamedDb(NAMED_DATABASES.AIMSATX)
      all.push(...(await searchCollection(aimsatx, "email_signups", "aimsatx", q, limit)))
    } catch (err) {
      console.warn("[find-by-tag] aimsatx scan failed:", err instanceof Error ? err.message : err)
    }
  }
  if (requestedCollections.includes("event_registrations")) {
    try {
      const techday = getNamedDb(NAMED_DATABASES.TECHDAY)
      all.push(...(await searchCollection(techday, "registrations", "techday", q, limit)))
    } catch (err) {
      console.warn("[find-by-tag] techday scan failed:", err instanceof Error ? err.message : err)
    }
    try {
      const dc = getDigitalCanvasDb()
      all.push(...(await searchCollection(dc, "event-registrations", "digitalcanvas", q, limit)))
    } catch (err) {
      console.warn(
        "[find-by-tag] digitalcanvas scan failed:",
        err instanceof Error ? err.message : err,
      )
    }
  }

  // Truncate to limit, sort by createdAt desc so newest matches surface first
  all.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
  const truncated = all.length > limit
  const matches = truncated ? all.slice(0, limit) : all

  // Aggregate counts
  const byCollection: Record<string, number> = {}
  const byDbSource: Record<string, number> = {}
  const emailSet = new Set<string>()
  for (const m of matches) {
    byCollection[m.collection] = (byCollection[m.collection] ?? 0) + 1
    byDbSource[m.dbSource] = (byDbSource[m.dbSource] ?? 0) + 1
    if (m.email) emailSet.add(m.email.toLowerCase())
  }

  const response: FindByTagResponse = {
    query: q,
    totalMatches: matches.length,
    truncated,
    byCollection,
    byDbSource,
    uniqueEmails: emailSet.size,
    matches,
  }

  console.log(
    `[find-by-tag] ${auth.session.email} q="${q}" → ${matches.length} matches, ${emailSet.size} unique emails`,
  )

  return NextResponse.json(response)
}
