// The cold-outreach gate, applied to a Person. No country list lives here: the single source of truth is the
// US allow-list in lib/prospecting/scorer.ts (CLAUDE.md, "Jurisdiction policy is one allow-list"). A Person is
// cold when its first-touch `source` is cold (`COLD_LEAD_SOURCES`), and then its `source`, `country` and
// `location` are locked against edits, exactly as on a lead.

import { coldGateEditRefusal, coldOutreachGateForLead } from "@/lib/prospecting/scorer"
import type { Person } from "@/types/core-model"

export function personColdGate(person: Pick<Person, "source" | "country" | "location">) {
  return coldOutreachGateForLead({ source: person.source, country: person.country, location: person.location })
}

/** Null when the edit is allowed; otherwise why it is refused (403 `jurisdiction_locked`). */
export function personColdEditRefusal(
  person: Pick<Person, "source" | "country" | "location">,
  patch: { source?: unknown; country?: unknown; location?: unknown },
): string | null {
  return coldGateEditRefusal({ source: person.source, country: person.country, location: person.location }, patch)
}
