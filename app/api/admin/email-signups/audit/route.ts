import { NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getDb, getNamedDb, NAMED_DATABASES } from "@/lib/firebase-admin"

export const runtime = "nodejs"
export const maxDuration = 30

interface RawRow {
  id: string
  email: string
  source: string
  created_at: string
}

interface SourceTally {
  source: string
  count: number
}

interface AuditResponse {
  ok: true
  defaultDb: {
    total: number
    distinctEmails: number
    sources: SourceTally[]
    mostRecent: string
  }
  aimsatxDb: {
    total: number
    distinctEmails: number
    sources: SourceTally[]
    mostRecent: string
  }
  overlap: {
    /** Emails present in BOTH databases (regardless of source label). */
    count: number
    /** Up to 20 sample overlapping emails. */
    sample: string[]
  }
  aimsatxOnly: {
    /** Emails present in aimsatx but NOT in default DB. */
    count: number
    sample: string[]
  }
  defaultOnly: {
    /** Emails present in default DB but NOT in aimsatx. */
    count: number
    sample: string[]
  }
  /** Headline number — what the deduped union actually contains. */
  unionDistinctEmails: number
  /** Source labels that look like AIM variants but aren't byte-equal. */
  aimSourceVariants: SourceTally[]
}

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

function fingerprintForAimVariant(source: string): boolean {
  return source.trim().toLowerCase() === "aim"
}

function tally(rows: RawRow[]): SourceTally[] {
  const counts = new Map<string, number>()
  for (const r of rows) {
    counts.set(r.source, (counts.get(r.source) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
}

function distinctEmails(rows: RawRow[]): Set<string> {
  const set = new Set<string>()
  for (const r of rows) {
    if (r.email) set.add(r.email.trim().toLowerCase())
  }
  return set
}

function mostRecent(rows: RawRow[]): string {
  let best = ""
  for (const r of rows) {
    if (r.created_at && r.created_at > best) best = r.created_at
  }
  return best
}

// GET /api/admin/email-signups/audit
//
// Read-only diagnostic. Reports what's actually sitting in the default DB vs
// the aimsatx named DB so we can decide how to clean up the dual-read setup
// without writing or deleting anything.
//
// Returns per-DB row counts, distinct source labels, email overlap between
// the two DBs, and a sample of overlapping/orphaned addresses.
export async function GET() {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const defaultDb = getDb()
    const aimsatxDb = getNamedDb(NAMED_DATABASES.AIMSATX)

    const [defaultSnap, aimsatxSnap] = await Promise.all([
      defaultDb.collection("email_signups").get(),
      aimsatxDb.collection("email_signups").get().catch((err) => {
        console.error("[email-signups/audit] aimsatx read failed:", err)
        return { docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }
      }),
    ])

    const defaultRows: RawRow[] = defaultSnap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        email: (data.email || "") as string,
        source: (data.source || "") as string,
        created_at: (data.created_at || "") as string,
      }
    })
    const aimsatxRows: RawRow[] = aimsatxSnap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        email: (data.email || "") as string,
        source: (data.source || "") as string,
        created_at: (data.created_at || "") as string,
      }
    })

    const defaultEmails = distinctEmails(defaultRows)
    const aimsatxEmails = distinctEmails(aimsatxRows)

    const overlapEmails: string[] = []
    const aimsatxOnlyEmails: string[] = []
    const defaultOnlyEmails: string[] = []

    for (const e of aimsatxEmails) {
      if (defaultEmails.has(e)) overlapEmails.push(e)
      else aimsatxOnlyEmails.push(e)
    }
    for (const e of defaultEmails) {
      if (!aimsatxEmails.has(e)) defaultOnlyEmails.push(e)
    }

    const unionDistinct = new Set<string>([...defaultEmails, ...aimsatxEmails])

    // Surface AIM-label variants across both DBs so we can see if "AIM", "aim",
    // "AIM " etc. exist as separate buckets in the count breakdown.
    const allRows = [...defaultRows, ...aimsatxRows]
    const aimVariantCounts = new Map<string, number>()
    for (const r of allRows) {
      if (fingerprintForAimVariant(r.source)) {
        aimVariantCounts.set(r.source, (aimVariantCounts.get(r.source) ?? 0) + 1)
      }
    }

    const response: AuditResponse = {
      ok: true,
      defaultDb: {
        total: defaultRows.length,
        distinctEmails: defaultEmails.size,
        sources: tally(defaultRows),
        mostRecent: mostRecent(defaultRows),
      },
      aimsatxDb: {
        total: aimsatxRows.length,
        distinctEmails: aimsatxEmails.size,
        sources: tally(aimsatxRows),
        mostRecent: mostRecent(aimsatxRows),
      },
      overlap: {
        count: overlapEmails.length,
        sample: overlapEmails.slice(0, 20),
      },
      aimsatxOnly: {
        count: aimsatxOnlyEmails.length,
        sample: aimsatxOnlyEmails.slice(0, 20),
      },
      defaultOnly: {
        count: defaultOnlyEmails.length,
        sample: defaultOnlyEmails.slice(0, 20),
      },
      unionDistinctEmails: unionDistinct.size,
      aimSourceVariants: Array.from(aimVariantCounts.entries())
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count),
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error("[GET /email-signups/audit]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Audit failed" },
      { status: 500 },
    )
  }
}
