import { type NextRequest } from "next/server"
import { runCronJob } from "@/lib/cron-auth"
import { runAutoSync } from "@/lib/mailchimp-autosync"

export const runtime = "nodejs"
export const maxDuration = 120

// Firestore → Mailchimp auto-sync (Phase 2 of the alignment plan). The mirror of
// the daily Mailchimp → Firestore `mailchimp-sync` cron; intended to run hourly.
//
// PHASE 1: DRY-RUN ONLY. This computes and logs exactly who *would* sync but
// writes nothing to Mailchimp. Flip `dryRun` to false (Phase 2) only after the
// dry-run output has been reviewed.
const DRY_RUN = true

export async function GET(request: NextRequest) {
  return runCronJob("mailchimp-push", request, async () => {
    const result = await runAutoSync({ dryRun: DRY_RUN })
    const verb = result.dryRun ? "would sync" : "synced"
    return {
      message:
        `[${result.dryRun ? "dry-run" : "live"}] ${result.uniqueContacts} unique contacts ${verb} ` +
        `(${result.included} included / ${result.skipped} skipped, ${result.groups.length} tag-groups)` +
        (result.push ? ` — ${result.push.newMembers} new, ${result.push.updatedMembers} updated, ${result.push.errors} errors` : ""),
      detail: result as unknown as Record<string, unknown>,
    }
  })
}
