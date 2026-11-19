import { NextResponse } from "next/server"
import { requireFounder } from "@/lib/founder-guard"

export const runtime = "nodejs"
export const maxDuration = 60

const NO_STORE = { "cache-control": "private, no-store" }

/**
 * The reference backfill's dry run (short references on records, V1 item 4), founder only and READ ONLY. It reads the
 * task and opportunity stores the CRM reads, applies the founder's decided rule (lib/record-refs-backfill.ts) and
 * returns, per type, how many records would be numbered, the first and last reference they would get, what was left
 * out and why, and the counters as they stand. It writes nothing: the write is a separate step on the founder's go.
 *
 * GET → 200 { rule, taskMigrationCompleted, taskCollections, scanned, summary: { TSK, OPP } }
 *       401/403 for anyone but the founder; 500 when the stores could not be read.
 */
export async function GET() {
  const auth = await requireFounder("GET /api/admin/refs/backfill-plan")
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status, headers: NO_STORE })
  try {
    const [{ getDb }, { LEGACY_TASK_COLLECTIONS }, { readBackfillPlan }] = await Promise.all([
      import("@/lib/firebase-admin"),
      import("@/lib/firestore-crm"),
      import("@/lib/record-refs-backfill-server"),
    ])
    const { rule, taskMigrationCompleted, taskCollections, scanned, summary } = await readBackfillPlan(getDb(), LEGACY_TASK_COLLECTIONS)
    return NextResponse.json({ rule, taskMigrationCompleted, taskCollections, scanned, summary }, { headers: NO_STORE })
  } catch (e) {
    console.error("[GET /api/admin/refs/backfill-plan]", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "The task and opportunity stores could not be read." }, { status: 500, headers: NO_STORE })
  }
}
