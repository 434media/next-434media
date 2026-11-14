/**
 * Decision memory on CRM records (434 build sequence V1 item 4, build plan v3: "what was chosen, why, any open concern,
 * and what should prompt a second look. Skills read it before acting and add to it after, keeping only what the next
 * helper needs").
 *
 * Each decision is its own small record in `crm_decisions`, linked to the Person, Organization or Opportunity it is about
 * by `subject_key` ("person:<id>"). Nothing is appended to the Person (the core model's rule for messages holds here
 * too). Decisions are written once: a changed mind is a new decision, and the newer one is read first.
 *
 * What a skill is given is `summarizeForSkill`: the newest decisions, bounded in count and length, as data. The summary
 * is handed to a run marked untrusted, like any other CRM content (build plan v3, "Context: a bounded, structured
 * summary, treated as untrusted").
 *
 * The record builder is pure; `listDecisions` reads, and the write is a `createDoc` inside the caller's transaction
 * (lib/agent/ledger-server.ts), so a decision and the ledger entry recording it commit together.
 */
import { CRM_COLLECTIONS } from "../../types/crm-types"

export const DECISION_SUBJECT_KINDS = ["person", "organization", "opportunity"] as const
export type DecisionSubjectKind = (typeof DECISION_SUBJECT_KINDS)[number]

export interface DecisionRecord {
  id: string
  subject: { kind: DecisionSubjectKind; id: string }
  /** "person:<id>": the one field reads filter on. */
  subject_key: string
  /** What was chosen. */
  chosen: string
  /** Why. */
  why: string
  /** Anything still unresolved. */
  open_concern?: string
  /** What should prompt a second look. */
  revisit_when?: string
  /** "founder", "skill:<name>" or "member:<id>". */
  by: string
  at: string
  /** The agent task it came from, when there was one. */
  task_id?: string
}

const LIMITS = { chosen: 300, why: 600, open_concern: 300, revisit_when: 200 } as const
const SUBJECT_ID = /^[A-Za-z0-9][A-Za-z0-9_.:~-]{0,199}$/
const BY = /^(founder|skill:[a-z0-9-]{1,64}|member:[A-Za-z0-9_-]{1,64})$/

export class DecisionRefused extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DecisionRefused"
  }
}

export const subjectKey = (kind: DecisionSubjectKind, id: string) => `${kind}:${id}`

/** Checks and shapes one decision. Every text field is trimmed and bounded; `chosen` and `why` are required. */
export function buildDecision(input: Omit<DecisionRecord, "subject_key">): DecisionRecord {
  if (!input.id || !SUBJECT_ID.test(input.id)) throw new DecisionRefused("A decision needs an id")
  if (!(DECISION_SUBJECT_KINDS as readonly string[]).includes(input.subject?.kind)) throw new DecisionRefused("A decision is about a person, an organization or an opportunity")
  if (!SUBJECT_ID.test(input.subject.id ?? "")) throw new DecisionRefused("A decision names its subject by id")
  if (!BY.test(input.by ?? "")) throw new DecisionRefused("A decision names who made it: founder, skill:<name> or member:<id>")
  if (!Number.isFinite(Date.parse(input.at))) throw new DecisionRefused("A decision needs a time")
  const text = (k: keyof typeof LIMITS, required: boolean): string | undefined => {
    const v = typeof input[k] === "string" ? (input[k] as string).trim() : ""
    if (!v) {
      if (required) throw new DecisionRefused(`A decision needs "${k}"`)
      return undefined
    }
    if (v.length > LIMITS[k]) throw new DecisionRefused(`"${k}" is over ${LIMITS[k]} characters; keep only what the next helper needs`)
    return v
  }
  const rec: DecisionRecord = {
    id: input.id,
    subject: { kind: input.subject.kind, id: input.subject.id },
    subject_key: subjectKey(input.subject.kind, input.subject.id),
    chosen: text("chosen", true)!,
    why: text("why", true)!,
    by: input.by,
    at: input.at,
  }
  const concern = text("open_concern", false)
  const revisit = text("revisit_when", false)
  if (concern) rec.open_concern = concern
  if (revisit) rec.revisit_when = revisit
  if (input.task_id) rec.task_id = input.task_id
  return rec
}

/**
 * What a skill run is given: the newest `max` decisions, newest first, as plain lines. Bounded so a long history never
 * crowds out the request; empty when there are none.
 */
export function summarizeForSkill(decisions: DecisionRecord[], max = 5): string {
  return [...decisions]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, max)
    .map((d) => {
      const parts = [`${d.at.slice(0, 10)} (${d.subject.kind}): chose ${d.chosen}. Why: ${d.why}`]
      if (d.open_concern) parts.push(`Open concern: ${d.open_concern}`)
      if (d.revisit_when) parts.push(`Look again when: ${d.revisit_when}`)
      return `- ${parts.join(" ")}`
    })
    .join("\n")
}

/** Decisions about one subject, newest first. Uncached: a decision made a moment ago must be read by the next run. */
export async function listDecisions(kind: DecisionSubjectKind, id: string, limit = 20): Promise<DecisionRecord[]> {
  const { getDb } = await import("../firebase-admin")
  const snap = await getDb().collection(CRM_COLLECTIONS.DECISIONS).where("subject_key", "==", subjectKey(kind, id)).get()
  return snap.docs
    .map((d) => d.data() as DecisionRecord)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, limit)
}
