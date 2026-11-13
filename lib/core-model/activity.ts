// Activities: every touch, written once and never edited. The CRM keeps the full text of what is sent and
// received (V1 item 4, founder 2026-11-12): an email activity is refused unless it carries its body, sender,
// recipients and time, and no body is ever truncated.

import type { Activity, ActivityContact, ActivityEmail, ActivityType, CoreSource } from "@/types/core-model"
import { ACTIVITY_TYPES, CORE_SOURCES } from "@/types/core-model"
import { normalizeEmail } from "./identity"

/** What a caller supplies to record an activity. `id`, `triaged` and `created_at` are set by the store. */
export interface ActivityInput {
  type: ActivityType
  source: CoreSource
  channel?: string
  occurred_at: string
  contact: ActivityContact
  person_id?: string
  organization_id?: string
  opportunity_id?: string
  job_id?: string
  summary: string
  body?: string
  email?: ActivityEmail
  legacy_ref?: Activity["legacy_ref"]
  created_by?: string
}

const isIso = (v: unknown) => typeof v === "string" && v.length > 0 && !Number.isNaN(Date.parse(v))

/** Null when the activity may be written; otherwise why not. */
export function validateActivity(input: ActivityInput): string | null {
  if (!ACTIVITY_TYPES.includes(input.type)) return `Unknown activity type "${String(input.type)}".`
  if (!CORE_SOURCES.includes(input.source)) return `Unknown source "${String(input.source)}".`
  if (!isIso(input.occurred_at)) return "An activity needs the time it happened (occurred_at)."
  if (!input.summary || !input.summary.trim()) return "An activity needs a summary."
  if (input.type === "email") {
    const e = input.email
    if (!e) return "An email activity must carry its envelope: sender, recipients, subject and direction."
    if (!input.body || !input.body.trim()) return "An email activity must keep the full text of the message (body)."
    if (!normalizeEmail(e.from)) return "An email activity needs its sender (from)."
    if (!Array.isArray(e.to) || e.to.filter((a) => normalizeEmail(a)).length === 0) {
      return "An email activity needs at least one recipient (to)."
    }
    if (e.direction !== "sent" && e.direction !== "received") return "An email activity needs a direction (sent or received)."
  }
  return null
}

/** A one-line summary from a body, for list views. The body itself is kept whole. */
export function summarize(text: string | undefined, fallback: string, max = 140): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim()
  if (!t) return fallback
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}
