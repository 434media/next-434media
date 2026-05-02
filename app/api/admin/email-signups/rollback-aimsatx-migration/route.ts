import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getDb } from "@/lib/firebase-admin"

export const runtime = "nodejs"
export const maxDuration = 60

const COLLECTION = "email_signups"
const MIGRATION_TAG = "aimsatx"

interface RollbackBody {
  /** When true (default), return the plan without deleting anything. */
  dryRun?: boolean
}

interface RollbackResponse {
  ok: true
  dryRun: boolean
  found: number
  deleted: number
  failed: number
  /** First 50 doc ids planned for deletion. */
  sampleIds: string[]
  errors: Array<{ id: string; error: string }>
}

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

// POST /api/admin/email-signups/rollback-aimsatx-migration
//
// Reverses the 2026-05-01 aimsatx → default DB migration by deleting every row
// in default DB that's tagged `_migrated_from: "aimsatx"`. The aimsatx data is
// untouched (it remains the source of truth via the dual-read in
// lib/firestore-email-signups.ts).
//
// Defaults to dry-run. Pass { dryRun: false } to actually delete.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: RollbackBody = {}
  try {
    body = await request.json()
  } catch {
    // Empty body is fine — falls through to dry-run default.
  }
  const dryRun = body.dryRun !== false

  try {
    const db = getDb()
    const snap = await db
      .collection(COLLECTION)
      .where("_migrated_from", "==", MIGRATION_TAG)
      .get()

    const ids = snap.docs.map((d) => d.id)
    const sampleIds = ids.slice(0, 50)

    let deleted = 0
    let failed = 0
    const errors: Array<{ id: string; error: string }> = []

    if (!dryRun && ids.length > 0) {
      // Firestore batch caps at 500 ops
      const CHUNK = 500
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK)
        const batch = db.batch()
        for (const id of chunk) {
          batch.delete(db.collection(COLLECTION).doc(id))
        }
        try {
          await batch.commit()
          deleted += chunk.length
        } catch (err) {
          failed += chunk.length
          for (const id of chunk) {
            errors.push({
              id,
              error: err instanceof Error ? err.message : "Batch delete failed",
            })
          }
        }
      }
    }

    const response: RollbackResponse = {
      ok: true,
      dryRun,
      found: ids.length,
      deleted,
      failed,
      sampleIds,
      errors,
    }

    console.log(
      `[rollback-aimsatx-migration] ${auth.session.email} ${dryRun ? "DRY-RUN" : "EXECUTED"}:`,
      JSON.stringify({ found: response.found, deleted: response.deleted, failed: response.failed }),
    )

    return NextResponse.json(response)
  } catch (err) {
    console.error("[POST /rollback-aimsatx-migration]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Rollback failed" },
      { status: 500 },
    )
  }
}
