// Lifecycle stage rules (spec, "One list of people"). People, Leads and Clients are stages of one Person:
// contact → lead → customer. **A client never reverts:** once a Person reaches `customer`, the stage never moves back
// to `lead` or `contact`, including when no job is in motion. Code refuses the move wherever a stage is written: the
// PATCH route, the service and the Firestore store's update transaction.

import type { LifecycleStage } from "@/types/core-model"

/** Null when the move is allowed; otherwise why not. */
export function stageMoveRefusal(from: LifecycleStage | undefined, to: LifecycleStage | undefined): string | null {
  if (!from || !to || from === to) return null
  if (from === "customer") return "A client never reverts: a customer's stage cannot move back to lead or contact."
  return null
}
