import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getDb, getNamedDb, NAMED_DATABASES } from "@/lib/firebase-admin"

export const runtime = "nodejs"
export const maxDuration = 120

const NORMALIZED_SOURCE = "AIM"
const COLLECTION = "email_signups"

interface MigrateBody {
  /** When true, return the plan without writing anything. */
  dryRun?: boolean
}

interface MigratePlanRow {
  email: string
  aimsatxId: string
  created_at: string
  decision: "insert" | "skip-already-in-default"
}

interface MigrateResponse {
  ok: true
  dryRun: boolean
  aimsatxRowsRead: number
  defaultDbAimEmailsBefore: number
  toInsert: number
  toSkip: number
  inserted: number              // 0 in dry-run mode
  failed: number
  /** First 50 planned operations for spot-checking. */
  samplePlan: MigratePlanRow[]
  /** Errors (if any) keyed by aimsatx doc id. */
  errors: Array<{ aimsatxId: string; email: string; error: string }>
}

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

interface AimsatxRow {
  id: string
  email: string
  source: string
  created_at: string
  page_url?: string
  mailchimp_synced?: boolean
  mailchimp_tags?: string[]
}

// POST /api/admin/email-signups/migrate-aimsatx
//
// One-shot migration: copies aimsatx-only email signups into the default DB
// with normalized source label "AIM". Idempotent — re-runs skip emails already
// present in the default DB (case-insensitive match).
//
// Pass { dryRun: true } first to see exactly what would happen without any
// writes. Once the plan looks right, re-call with { dryRun: false } to execute.
//
// This does NOT delete from aimsatx. After running this, both DBs hold the
// data; the dual-read can be removed in a follow-up PR once the AIM website
// is rewired to write directly to the default DB via /api/public/email-signup.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: MigrateBody = {}
  try {
    body = await request.json()
  } catch {
    // Empty/invalid body is fine — defaults to dryRun: false. But to be safe
    // for an explicit-action endpoint we'll keep dryRun the explicit choice.
  }
  const dryRun = body.dryRun !== false // default to dry-run unless explicitly false

  try {
    const defaultDb = getDb()
    const aimsatxDb = getNamedDb(NAMED_DATABASES.AIMSATX)

    // 1) Pull every aimsatx row + every default-DB email (lowercased)
    const [aimsatxSnap, defaultSnap] = await Promise.all([
      aimsatxDb.collection(COLLECTION).get(),
      defaultDb.collection(COLLECTION).get(),
    ])

    const defaultEmails = new Set<string>()
    for (const doc of defaultSnap.docs) {
      const e = (doc.data().email || "") as string
      if (e) defaultEmails.add(e.trim().toLowerCase())
    }

    const aimsatxRows: AimsatxRow[] = aimsatxSnap.docs
      .map((d) => {
        const data = d.data()
        return {
          id: d.id,
          email: ((data.email || "") as string).trim().toLowerCase(),
          source: (data.source || NORMALIZED_SOURCE) as string,
          created_at: (data.created_at || "") as string,
          page_url: (data.pageUrl || data.page_url || "") as string,
          mailchimp_synced: !!data.mailchimp_synced,
          mailchimp_tags: Array.isArray(data.tags || data.mailchimp_tags)
            ? (data.tags || data.mailchimp_tags)
            : [],
        }
      })
      .filter((r) => !!r.email)

    // 2) Decide per-row
    interface Plan extends AimsatxRow {
      decision: "insert" | "skip-already-in-default"
    }
    const plan: Plan[] = aimsatxRows.map((r) => ({
      ...r,
      decision: defaultEmails.has(r.email) ? "skip-already-in-default" : "insert",
    }))

    // Within the to-insert set, dedupe to the earliest created_at per email
    // so we don't insert the same aimsatx-only email twice (aimsatx itself has
    // intra-DB dupes — 320 rows / 280 distinct emails per the audit).
    const toInsertByEmail = new Map<string, Plan>()
    for (const p of plan) {
      if (p.decision !== "insert") continue
      const existing = toInsertByEmail.get(p.email)
      if (!existing || (p.created_at && p.created_at < existing.created_at)) {
        toInsertByEmail.set(p.email, p)
      }
    }

    const toInsert = Array.from(toInsertByEmail.values())
    const skipped = plan.filter((p) => p.decision === "skip-already-in-default").length

    const samplePlan: MigratePlanRow[] = plan.slice(0, 50).map((p) => ({
      email: p.email,
      aimsatxId: p.id,
      created_at: p.created_at,
      decision: p.decision,
    }))

    let inserted = 0
    let failed = 0
    const errors: Array<{ aimsatxId: string; email: string; error: string }> = []

    if (!dryRun && toInsert.length > 0) {
      // Firestore writeBatch caps at 500 operations
      const CHUNK = 500
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const chunk = toInsert.slice(i, i + CHUNK)
        const batch = defaultDb.batch()
        for (const row of chunk) {
          const ref = defaultDb.collection(COLLECTION).doc()
          batch.set(ref, {
            email: row.email,
            source: NORMALIZED_SOURCE,
            created_at: row.created_at || new Date().toISOString(),
            page_url: row.page_url || "",
            mailchimp_synced: row.mailchimp_synced,
            mailchimp_tags: row.mailchimp_tags,
            // Traceability — lets us identify migrated rows later if needed
            _migrated_from: "aimsatx",
            _migrated_at: new Date().toISOString(),
            _aimsatx_doc_id: row.id,
          })
        }
        try {
          await batch.commit()
          inserted += chunk.length
        } catch (err) {
          failed += chunk.length
          for (const row of chunk) {
            errors.push({
              aimsatxId: row.id,
              email: row.email,
              error: err instanceof Error ? err.message : "Batch commit failed",
            })
          }
        }
      }
    }

    const response: MigrateResponse = {
      ok: true,
      dryRun,
      aimsatxRowsRead: aimsatxRows.length,
      defaultDbAimEmailsBefore: defaultEmails.size,
      toInsert: toInsert.length,
      toSkip: skipped,
      inserted,
      failed,
      samplePlan,
      errors,
    }

    console.log(
      `[migrate-aimsatx] ${auth.session.email} ${dryRun ? "DRY-RUN" : "EXECUTED"}:`,
      JSON.stringify({
        aimsatxRowsRead: response.aimsatxRowsRead,
        toInsert: response.toInsert,
        toSkip: response.toSkip,
        inserted: response.inserted,
        failed: response.failed,
      }),
    )

    return NextResponse.json(response)
  } catch (err) {
    console.error("[POST /email-signups/migrate-aimsatx]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Migration failed" },
      { status: 500 },
    )
  }
}
