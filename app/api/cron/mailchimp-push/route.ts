import { type NextRequest } from "next/server"
import { runCronJob } from "@/lib/cron-auth"
import { runAutoSync } from "@/lib/mailchimp-autosync"

export const runtime = "nodejs"
export const maxDuration = 300

// Firestore → Mailchimp auto-sync (Phase 2 of the alignment plan). The mirror of
// the daily Mailchimp → Firestore `mailchimp-sync` cron; runs hourly.
//
// LIVE. Each run upserts consent-bearing contacts that are new or changed since
// the last successful push, and once a day all of them, stopping at a time budget
// well inside maxDuration (lib/mailchimp-push-plan.ts). Safe to repeat: pushMembersToMailchimp uses update_existing + status_if_new, so existing
// members never have their status changed (no resurrection of opt-outs) — only
// brand-new emails get `subscribed`, and tags refresh harmlessly.
//
// Preview without writing: GET this route with `?dryRun=1` and the header
// `Authorization: Bearer <CRON_SECRET>` (the `?secret=` form was removed in 2b fix 11).
export async function GET(request: NextRequest) {
  return runCronJob("mailchimp-push", request, async () => {
    const dryRun = request.nextUrl.searchParams.get("dryRun") === "1"
    const result = await runAutoSync({ dryRun })
    const verb = result.dryRun ? "would sync" : "synced"
    return {
      message:
        `[${result.dryRun ? "dry-run" : "live"}${result.fullPass ? ", full pass" : ""}] ` +
        `${result.pending} of ${result.uniqueContacts} unique contacts ${verb} ` +
        `(${result.included} included / ${result.skipped} skipped, ${result.groups.length} tag-groups)` +
        (result.push
          ? ` — ${result.push.newMembers} new, ${result.push.updatedMembers} updated, ${result.push.errors} errors` +
            (result.push.deferred ? `, ${result.push.deferred} left for the next run` : "")
          : ""),
      detail: result as unknown as Record<string, unknown>,
    }
  })
}
