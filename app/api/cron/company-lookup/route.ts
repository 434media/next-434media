import { type NextRequest } from "next/server"
import { runCronJob } from "@/lib/cron-auth"
import { runCompanyLookupSweep } from "@/lib/core-model/company-lookup-server"

export const runtime = "nodejs"
export const maxDuration = 120

/**
 * The company lookup, hourly: each untriaged business arrival in the inbox whose company is unknown or thin is looked
 * up once by its email domain (Apollo, one credit per match), up to the per-run and daily caps. A website-form arrival
 * is usually looked up already, right after it was saved; this catches the rest and any that failed.
 */
export async function GET(request: NextRequest) {
  return runCronJob("company-lookup", request, async () => {
    const r = await runCompanyLookupSweep()
    const errors = r.outcomes.filter((o) => o.status === "error").length
    const capped = r.outcomes.some((o) => o.status === "skipped" && o.reason === "daily_cap")
    return {
      message: `company-lookup: ${r.lookedUp} looked up, ${r.credits} credits${capped ? ", daily cap reached" : ""}${errors ? `, ${errors} failed` : ""}`,
      detail: { lookedUp: r.lookedUp, credits: r.credits, outcomes: r.outcomes },
      status: errors ? "partial" : "success",
    }
  })
}
