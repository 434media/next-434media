import type { NextRequest } from "next/server"
import { serveBackups } from "@/lib/content-pipeline/profile-backup"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/brand-profiles/backups?after=<brand>:<n>,… — the read-only backup feed 434-context pulls daily (plan
 * v11.1, Step 2b). Gated by its own read credential, BRAND_PROFILE_BACKUP_READ_TOKEN, not the admin session; it lists
 * published versions and changes nothing. The contract is lib/content-pipeline/profile-backup.ts serveBackups.
 */
export async function GET(req: NextRequest) {
  return serveBackups(req, async () => (await import("@/lib/firestore-brand-profiles")).firestoreBrandProfiles())
}
