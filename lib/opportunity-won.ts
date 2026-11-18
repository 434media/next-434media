/**
 * What happens when an opportunity moves to Won, in one place: the GA4 server-side `opportunity_won` event, fired on
 * the transition only (not on a re-save of an already-won opportunity). The client update route and the Ask panel's
 * Confirm (lib/ask/server.ts) both call it, so a stage change made either way has the same effect.
 */
import type { ClientRecord } from "@/types/crm-types"
import { trackOpportunityWon } from "@/lib/ga4-events"

export function wonTransition(before: Pick<ClientRecord, "disposition"> | null, after: Pick<ClientRecord, "is_opportunity" | "disposition">): boolean {
  return Boolean(after.is_opportunity && after.disposition === "closed_won" && before?.disposition !== "closed_won")
}

/** Fire-and-forget: analytics must never break the close. */
export function afterClientUpdate(before: ClientRecord | null, client: ClientRecord): void {
  if (!wonTransition(before, client)) return
  const value = typeof client.pitch_value === "number" ? client.pitch_value : Number(client.pitch_value) || 0
  const primaryEmail = client.email || client.contacts?.find((c) => c.is_primary)?.email || client.contacts?.[0]?.email
  trackOpportunityWon({ email: primaryEmail, brand: client.brand, value, clientId: client.id }).catch(() => {
    /* swallowed: analytics must not break the close */
  })
}
