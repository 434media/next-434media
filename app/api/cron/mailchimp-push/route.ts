import { type NextRequest } from "next/server"
import { runCronJob } from "@/lib/cron-auth"
import { runAutoSync } from "@/lib/mailchimp-autosync"

export const runtime = "nodejs"
export const maxDuration = 120

// Firestore → Mailchimp auto-sync (Phase 2 of the alignment plan). The mirror of
// the daily Mailchimp → Firestore `mailchimp-sync` cron; runs hourly.
//
// LIVE. Each run upserts consent-bearing contacts with canonical tags. Safe to
// repeat: pushMembersToMailchimp uses update_existing + status_if_new, so existing
// members never have their status changed (no resurrection of opt-outs) — only
// brand-new emails get `subscribed`, and tags refresh harmlessly.
//
// Preview without writing: hit this route with `?secret=<CRON_SECRET>&dryRun=1`.
export async function GET(request: NextRequest) {
  return runCronJob("mailchimp-push", request, async () => {
    const dryRun = request.nextUrl.searchParams.get("dryRun") === "1"
    const result = await runAutoSync({ dryRun })
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
