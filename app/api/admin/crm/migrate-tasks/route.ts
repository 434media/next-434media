import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getTaskMigrationStatus, runTaskMigration } from "@/lib/migrate-unified-tasks"
import { invalidateTaskMigrationFlag } from "@/lib/firestore-crm"
import { isCrmSuperAdmin } from "@/components/crm/types"

export const runtime = "nodejs"
export const maxDuration = 300

async function requireSuperAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) return { error: "Forbidden", status: 403 as const }
  if (!isCrmSuperAdmin(session.email)) {
    return { error: "Super admin required to run task migration", status: 403 as const }
  }
  return { session }
}

// GET — return current migration status
export async function GET() {
  const auth = await requireSuperAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const status = await getTaskMigrationStatus()
  return NextResponse.json({ success: true, status })
}

// POST — run the migration. Pass { dryRun: true } in body to preview.
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: { dryRun?: boolean } = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  const dryRun = body.dryRun !== false // default true; explicit `false` to commit

  try {
    const result = await runTaskMigration({ dryRun })
    if (!dryRun) invalidateTaskMigrationFlag()
    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error("[migrate-tasks] failed:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
