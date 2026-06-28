import { Timestamp, FieldValue } from "firebase-admin/firestore"
import { getDb } from "./firebase-admin"
import { scoreLead } from "./score-lead"
import { trackLeadCapture, trackLeadQualified } from "./ga4-events"
import { makeTag, normalizeLegacyTags } from "./tag-taxonomy"
import {
  CRM_COLLECTIONS,
  type Lead,
  type LeadActivityEvent,
  type LeadActivityType,
  type LeadCreateInput,
  type LeadStatus,
  type LeadUpdateInput,
} from "../types/crm-types"
import crypto from "crypto"

const COLLECTION = CRM_COLLECTIONS.LEADS

// 30s in-memory cache mirroring firestore-crm.ts. Invalidated on any write.
const CACHE_TTL = 30 * 1000
let listCache: { data: Lead[]; ts: number } | null = null

function invalidate(): void {
  listCache = null
}

function toIsoString(value: unknown): string {
  if (!value) return ""
  if (typeof value === "string") return value
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (typeof value === "object" && value !== null && "toDate" in value) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString()
    } catch {
      return ""
    }
  }
  return ""
}

function normalize(id: string, raw: FirebaseFirestore.DocumentData): Lead {
  return {
    id,
    name: (raw.name || "") as string,
    company: (raw.company || "") as string,
    title: raw.title || undefined,
    email: (raw.email || "") as string,
    phone: raw.phone || undefined,
    linkedin: raw.linkedin || undefined,
    source: (raw.source || "manual") as Lead["source"],
    industry: raw.industry || undefined,
    location: raw.location || undefined,
    platform: raw.platform || undefined,
    score: typeof raw.score === "number" ? raw.score : 0,
    priority: (raw.priority || "low") as Lead["priority"],
    score_breakdown: (raw.score_breakdown || {}) as Lead["score_breakdown"],
    icp_fit_score: typeof raw.icp_fit_score === "number" ? raw.icp_fit_score : undefined,
    icp_grade: (raw.icp_grade || undefined) as Lead["icp_grade"],
    icp_breakdown:
      raw.icp_breakdown && typeof raw.icp_breakdown === "object"
        ? (raw.icp_breakdown as Lead["icp_breakdown"])
        : undefined,
    intent_score: typeof raw.intent_score === "number" ? raw.intent_score : undefined,
    intent_breakdown:
      raw.intent_breakdown && typeof raw.intent_breakdown === "object"
        ? (raw.intent_breakdown as Lead["intent_breakdown"])
        : undefined,
    employee_count: typeof raw.employee_count === "number" ? raw.employee_count : undefined,
    annual_revenue: typeof raw.annual_revenue === "number" ? raw.annual_revenue : undefined,
    status: (raw.status || "new") as LeadStatus,
    assigned_to: raw.assigned_to || undefined,
    disqualified_reason: raw.disqualified_reason || undefined,
    outreach_draft: raw.outreach_draft || undefined,
    draft_generated_at: toIsoString(raw.draft_generated_at) || undefined,
    last_contacted_at: toIsoString(raw.last_contacted_at) || undefined,
    next_followup_date: toIsoString(raw.next_followup_date) || undefined,
    outreach_sequence:
      raw.outreach_sequence && typeof raw.outreach_sequence === "object"
        ? (raw.outreach_sequence as Lead["outreach_sequence"])
        : undefined,
    resend_email_id: raw.resend_email_id || undefined,
    email_opens: typeof raw.email_opens === "number" ? raw.email_opens : 0,
    email_clicks: typeof raw.email_clicks === "number" ? raw.email_clicks : 0,
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : undefined,
    notes: raw.notes || undefined,
    activity: Array.isArray(raw.activity) ? (raw.activity as Lead["activity"]) : undefined,
    research: raw.research && typeof raw.research === "object" ? (raw.research as Lead["research"]) : undefined,
    created_by: raw.created_by || undefined,
    enriched_at: toIsoString(raw.enriched_at) || undefined,
    converted_to_client_id: raw.converted_to_client_id || undefined,
    converted_at: toIsoString(raw.converted_at) || undefined,
    origin_ref:
      raw.origin_ref && typeof raw.origin_ref === "object"
        ? (raw.origin_ref as Lead["origin_ref"])
        : undefined,
    created_at: toIsoString(raw.created_at),
    updated_at: toIsoString(raw.updated_at),
  }
}

export async function getLeads(): Promise<Lead[]> {
  if (listCache && Date.now() - listCache.ts < CACHE_TTL) return listCache.data
  const db = getDb()
  const snap = await db.collection(COLLECTION).orderBy("created_at", "desc").get()
  const data = snap.docs.map((d) => normalize(d.id, d.data()))
  listCache = { data, ts: Date.now() }
  return data
}

export async function getLeadById(id: string): Promise<Lead | null> {
  const db = getDb()
  const doc = await db.collection(COLLECTION).doc(id).get()
  if (!doc.exists) return null
  const data = doc.data()
  if (!data) return null
  return normalize(doc.id, data)
}

/**
 * Find an existing lead by email (case-insensitive). Used for dedupe when
 * public form handlers fan into `leads` and to surface duplicates in the UI.
 */
export async function findLeadByEmail(email: string): Promise<Lead | null> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return null
  const db = getDb()
  const snap = await db
    .collection(COLLECTION)
    .where("email", "==", normalized)
    .limit(1)
    .get()
  if (snap.empty) return null
  const doc = snap.docs[0]
  return normalize(doc.id, doc.data())
}

export async function createLead(input: LeadCreateInput): Promise<Lead> {
  const db = getDb()
  const now = new Date().toISOString()

  // Score inline on create. The scoring function reads from a partial Lead,
  // so we hand it the input plus zeroed engagement counters.
  const scored = scoreLead({
    location: input.location,
    industry: input.industry,
    title: input.title,
    company: input.company,
    employee_count: input.employee_count,
    annual_revenue: input.annual_revenue,
    source: input.source,
    email_opens: 0,
    email_clicks: 0,
    tags: input.tags,
  })

  const doc = {
    name: input.name,
    company: input.company,
    title: input.title ?? null,
    email: input.email.trim().toLowerCase(),
    phone: input.phone ?? null,
    linkedin: input.linkedin ?? null,
    source: input.source,
    industry: input.industry ?? null,
    location: input.location ?? null,
    platform: input.platform ?? null,
    score: scored.score,
    priority: scored.priority,
    score_breakdown: scored.breakdown,
    icp_fit_score: scored.icp_fit_score,
    icp_grade: scored.icp_grade,
    icp_breakdown: scored.icp_breakdown,
    intent_score: scored.intent_score,
    intent_breakdown: scored.intent_breakdown,
    employee_count: input.employee_count ?? null,
    annual_revenue: input.annual_revenue ?? null,
    status: input.status ?? "new",
    assigned_to: input.assigned_to ?? null,
    outreach_draft: input.outreach_draft ?? null,
    draft_generated_at: null,
    last_contacted_at: null,
    next_followup_date: input.next_followup_date ?? null,
    resend_email_id: null,
    email_opens: 0,
    email_clicks: 0,
    tags: input.tags ?? [],
    notes: input.notes ?? null,
    // Seed the activity log with the creation event so the timeline always has
    // an origin entry (source tells the rep where it came from).
    activity: [
      {
        id: crypto.randomUUID(),
        type: "created" as const,
        at: now,
        ...(input.created_by ? { actor: input.created_by } : {}),
        detail: `Lead created · source: ${input.source}`,
      },
    ],
    created_by: input.created_by ?? null,
    enriched_at: now,
    converted_to_client_id: null,
    converted_at: null,
    // Provenance backlink — set when this lead was promoted from an
    // audience-side record (partner_list_members, event_registrations, etc.).
    // Null for direct creates (Apollo prospect, manual entry, web form).
    origin_ref: input.origin_ref ?? null,
    created_at: now,
    updated_at: now,
  }

  const ref = await db.collection(COLLECTION).add(doc)
  invalidate()
  const created = normalize(ref.id, doc)
  // Fire-and-forget GA4 server-side event. Never throws — see ga4-events.ts.
  // We log the capture for every NEW lead created via any path (manual,
  // public form fan-in, Mailchimp webhook, etc.).
  trackLeadCapture({
    email: created.email,
    source: created.source,
    platform: created.platform,
    company: created.company,
    score: created.score,
  }).catch(() => {
    /* swallowed — analytics must not break creation */
  })
  return created
}

export async function updateLead(id: string, patch: LeadUpdateInput): Promise<Lead> {
  const db = getDb()
  const ref = db.collection(COLLECTION).doc(id)
  const existing = await ref.get()
  if (!existing.exists) throw new Error(`Lead ${id} not found`)

  const current = normalize(id, existing.data() ?? {})

  // Re-score on every write. We merge patch into current so the scoring fn
  // sees the post-update state.
  const merged = { ...current, ...patch }
  const scored = scoreLead({
    location: merged.location,
    industry: merged.industry,
    title: merged.title,
    company: merged.company,
    employee_count: merged.employee_count,
    annual_revenue: merged.annual_revenue,
    source: merged.source,
    email_opens: merged.email_opens,
    email_clicks: merged.email_clicks,
    tags: merged.tags,
  })

  const update: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
    ...patch,
    score: scored.score,
    priority: scored.priority,
    score_breakdown: scored.breakdown,
    icp_fit_score: scored.icp_fit_score,
    icp_grade: scored.icp_grade,
    icp_breakdown: scored.icp_breakdown,
    intent_score: scored.intent_score,
    intent_breakdown: scored.intent_breakdown,
    enriched_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  // Normalize email casing if it's being changed
  if (typeof patch.email === "string") {
    update.email = patch.email.trim().toLowerCase()
  }

  // Clear the removal reason whenever a lead leaves the archived state — a
  // reactivated lead is "kept" again, so a stale reason would skew the
  // kept-vs-removed KPI. (When archiving, the reason rides in via `patch`.)
  if (typeof patch.status === "string" && patch.status !== "archived") {
    update.disqualified_reason = FieldValue.delete()
  }

  await ref.update(update)
  invalidate()

  // Log a status-change event when the patch actually flips status. Done inline
  // (not via appendLeadActivity) so it's part of the same read-after-write — the
  // returned lead includes the new event. Best-effort: a log failure shouldn't
  // fail the update.
  if (typeof patch.status === "string" && patch.status !== current.status) {
    try {
      await ref.update({
        activity: FieldValue.arrayUnion({
          id: crypto.randomUUID(),
          type: "status_changed",
          at: new Date().toISOString(),
          detail: `${current.status} → ${patch.status}`,
        }),
      })
    } catch {
      /* non-fatal — the status change itself already persisted */
    }
  }

  const after = await ref.get()
  const updatedLead = normalize(id, after.data() ?? {})

  // GA4 server-side event on the `→ engaged` transition. We compare against
  // the pre-update status so re-saves of an already-engaged lead don't fire
  // duplicate qualification events.
  if (current.status !== "engaged" && updatedLead.status === "engaged") {
    trackLeadQualified({
      email: updatedLead.email,
      platform: updatedLead.platform,
      score: updatedLead.score,
      source: updatedLead.source,
    }).catch(() => {
      /* swallowed */
    })
  }

  return updatedLead
}

// Append an activity event to a lead's log (atomic arrayUnion). Best-effort by
// design — callers wrap in catch so a logging failure never blocks the real
// action (sending an email, converting, etc.). Does NOT re-score or bump
// updated_at — it's a side-channel append, not a lead edit.
export async function appendLeadActivity(
  id: string,
  event: { type: LeadActivityType; actor?: string; detail?: string },
): Promise<void> {
  const db = getDb()
  const entry: LeadActivityEvent = {
    id: crypto.randomUUID(),
    type: event.type,
    at: new Date().toISOString(),
    ...(event.actor ? { actor: event.actor } : {}),
    ...(event.detail ? { detail: event.detail } : {}),
  }
  await db.collection(COLLECTION).doc(id).update({
    activity: FieldValue.arrayUnion(entry),
  })
  invalidate()
}

export async function deleteLead(id: string): Promise<void> {
  const db = getDb()
  await db.collection(COLLECTION).doc(id).delete()
  invalidate()
}

/**
 * Map a public-form `source` code (the value the external sites POST to
 * /api/public/contact-form and /api/public/email-signup) onto a LeadPlatform.
 * Codes not in the LeadPlatform enum are intentionally returned as undefined —
 * the lead still gets captured, just without a platform tag.
 */
function inferPlatform(publicSource: string): Lead["platform"] {
  switch (publicSource) {
    case "434Media":
      return "434 Media"
    case "TXMX":
      return "TXMX"
    case "VemosVamos":
      return "VemosVamos"
    case "MilCity":
      return "MilCity"
    case "SATechDay":
      return "DevSA"
    default:
      return undefined // AIM, AMPD, Salute, DigitalCanvas, SDOH — no enum match
  }
}

interface ContactFormCapture {
  firstName: string
  lastName: string
  company: string
  email: string
  phone?: string
  message?: string
  source: string
  pageUrl?: string
}

/**
 * Fan a public contact-form submission into the `leads` collection.
 * Deduplicates by email (case-insensitive). Existing leads are touched —
 * we refresh `enriched_at` and append the source tag so downstream filters
 * see this email come in again — but no duplicate row is created.
 *
 * Designed to never throw. The caller is a public form route; if `leads`
 * is unavailable, the form submission must still succeed against its
 * primary store. Errors are logged and swallowed.
 */
export async function captureLeadFromContactForm(
  input: ContactFormCapture,
): Promise<{ leadId: string | null; created: boolean }> {
  try {
    const email = input.email.trim().toLowerCase()
    const existing = await findLeadByEmail(email)
    const captureTags = ["source:form", makeTag("site", input.source)]

    if (existing) {
      const tags = Array.from(
        new Set([...normalizeLegacyTags(existing.tags), ...captureTags]),
      )
      await updateLead(existing.id, {
        tags,
        // Append the new message to notes if there's a meaningful body
        notes:
          input.message && input.message.trim().length > 0
            ? [existing.notes, `[${new Date().toISOString().split("T")[0]} ${input.source}] ${input.message.trim()}`]
                .filter(Boolean)
                .join("\n\n")
            : existing.notes,
      })
      return { leadId: existing.id, created: false }
    }

    const lead = await createLead({
      name: `${input.firstName} ${input.lastName}`.trim() || email,
      company: input.company || "",
      email,
      phone: input.phone || undefined,
      source: "web",
      platform: inferPlatform(input.source),
      tags: captureTags,
      notes: input.message?.trim() || undefined,
    })
    return { leadId: lead.id, created: true }
  } catch (err) {
    console.error("[captureLeadFromContactForm] swallowed error:", err)
    return { leadId: null, created: false }
  }
}

interface EmailSignupCapture {
  email: string
  source: string
  tags?: string[]
  pageUrl?: string
}

/**
 * Fan a public email-signup into the `leads` collection.
 * Newsletter signups have less detail (often just an email) — they enter
 * with status `new`, source `newsletter`, and a low score. Worth capturing
 * because Mailchimp engagement signals later will lift their priority.
 *
 * Same fail-safe behavior as captureLeadFromContactForm — never throws.
 */
export async function captureLeadFromEmailSignup(
  input: EmailSignupCapture,
): Promise<{ leadId: string | null; created: boolean }> {
  try {
    const email = input.email.trim().toLowerCase()
    const existing = await findLeadByEmail(email)
    const captureTags = ["source:newsletter", makeTag("site", input.source)]
    const incomingTags = normalizeLegacyTags(input.tags)

    if (existing) {
      const tags = Array.from(
        new Set([...normalizeLegacyTags(existing.tags), ...captureTags, ...incomingTags]),
      )
      await updateLead(existing.id, { tags })
      return { leadId: existing.id, created: false }
    }

    const lead = await createLead({
      name: email,
      company: "",
      email,
      source: "newsletter",
      platform: inferPlatform(input.source),
      tags: [...captureTags, ...incomingTags],
    })
    return { leadId: lead.id, created: true }
  } catch (err) {
    console.error("[captureLeadFromEmailSignup] swallowed error:", err)
    return { leadId: null, created: false }
  }
}

interface EventRegistrationCapture {
  email: string
  firstName: string
  lastName: string
  company?: string
  eventName: string
  eventSlug: string
  eventDate?: string
  pageUrl?: string
}

/**
 * Fan an event registration into the `leads` collection.
 * Source is "event" (so scoring picks up the +event bonus). Tags the lead with
 * `event:<slug>` for downstream filtering, and stores the event name in notes
 * so the CRM card shows what they registered for.
 *
 * Same fail-safe behavior as the other captureLeadFrom* helpers.
 */
export async function captureLeadFromEventRegistration(
  input: EventRegistrationCapture,
): Promise<{ leadId: string | null; created: boolean }> {
  try {
    const email = input.email.trim().toLowerCase()
    const existing = await findLeadByEmail(email)
    const captureTags = ["source:event", makeTag("event", input.eventSlug)]
    const noteLine = `[${(input.eventDate || new Date().toISOString()).split("T")[0]}] Registered for ${input.eventName}`

    if (existing) {
      const tags = Array.from(
        new Set([...normalizeLegacyTags(existing.tags), ...captureTags]),
      )
      await updateLead(existing.id, {
        tags,
        notes: [existing.notes, noteLine].filter(Boolean).join("\n\n"),
      })
      return { leadId: existing.id, created: false }
    }

    const lead = await createLead({
      name: `${input.firstName} ${input.lastName}`.trim() || email,
      company: input.company || "",
      email,
      source: "event",
      platform: inferPlatform(input.eventSlug),
      tags: captureTags,
      notes: noteLine,
    })
    return { leadId: lead.id, created: true }
  } catch (err) {
    console.error("[captureLeadFromEventRegistration] swallowed error:", err)
    return { leadId: null, created: false }
  }
}

interface PartnerListCapture {
  email: string
  firstName?: string
  lastName?: string
  preferredName?: string
  company?: string
  phone?: string
  linkedin?: string
  // Slug of the partner who shared the list (e.g. "alamo-angels"). Drives
  // the `partner:<slug>` tag and the import-receipt note line.
  partnerSlug: string
  // Display name for the partner (e.g. "Alamo Angels"). Used in the note
  // line so the CRM card is human-readable.
  partnerName: string
  // ISO date the row entered the partner's list. When provided, prefixes
  // the import note. Otherwise today's date is used.
  joinedAt?: string
  // Free-form tags from the import (e.g. "member-tier:lifetime",
  // "demographic:woman-investor"). Already-namespaced; passed through.
  extraTags?: string[]
  // Optional initial note (e.g. multi-contact org context: "Co-contact
  // alongside Robby Brown at DOCUmation"). Appended to the note line.
  noteSuffix?: string
}

/**
 * Fan a partner-shared roster row into the `leads` collection.
 *
 * Distinct from event/form/newsletter captures because:
 *  - Source is "partner" (no implied inbound intent — affects scoring).
 *  - Tags include `source:partner` + `partner:<slug>` for filtering.
 *  - Phone / LinkedIn flow through to first-class Lead fields, not notes.
 *  - Preferred name (when present) seeds the lead `name` so the CRM card
 *    shows what the contact actually goes by.
 *
 * Same fail-safe shape as the other captureLeadFrom* helpers — returns
 * { leadId: null, created: false } on internal errors so a bulk import
 * keeps going row-by-row.
 *
 * Idempotent: re-importing the same list updates tags/notes/missing
 * fields on existing leads instead of duplicating. Phone and LinkedIn
 * are backfilled only when the existing lead has no value (history-
 * preserving — same rule we adopted for EventRegistration backfills).
 */
export async function captureLeadFromPartnerList(
  input: PartnerListCapture,
): Promise<{ leadId: string | null; created: boolean }> {
  try {
    const email = input.email.trim().toLowerCase()
    const fullName =
      input.preferredName?.trim() ||
      `${input.firstName ?? ""} ${input.lastName ?? ""}`.trim() ||
      email
    const existing = await findLeadByEmail(email)
    const captureTags = [
      "source:partner",
      makeTag("partner", input.partnerSlug),
      ...(input.extraTags ?? []),
    ]
    const stamp = (input.joinedAt || new Date().toISOString()).split("T")[0]
    const noteLine = `[${stamp}] Imported from ${input.partnerName}${
      input.noteSuffix ? ` — ${input.noteSuffix}` : ""
    }`

    if (existing) {
      const tags = Array.from(
        new Set([...normalizeLegacyTags(existing.tags), ...captureTags]),
      )
      // Backfill-only for phone / linkedin / company — never overwrite a
      // value already on the lead, only fill blanks. Keeps history intact.
      const patch: Parameters<typeof updateLead>[1] = {
        tags,
        notes: [existing.notes, noteLine].filter(Boolean).join("\n\n"),
      }
      if (!existing.phone && input.phone) patch.phone = input.phone
      if (!existing.linkedin && input.linkedin) patch.linkedin = input.linkedin
      if (!existing.company && input.company) patch.company = input.company
      await updateLead(existing.id, patch)
      return { leadId: existing.id, created: false }
    }

    const lead = await createLead({
      name: fullName,
      company: input.company || "",
      email,
      phone: input.phone,
      linkedin: input.linkedin,
      source: "partner",
      tags: captureTags,
      notes: noteLine,
    })
    return { leadId: lead.id, created: true }
  } catch (err) {
    console.error("[captureLeadFromPartnerList] swallowed error:", err)
    return { leadId: null, created: false }
  }
}

interface ProspectingCapture {
  email: string
  firstName: string
  lastName?: string
  title?: string
  company: string
  linkedin?: string
  /** Optional location parts — combined into the lead's `location` field if present. */
  city?: string
  state?: string
  industry?: string
  /** Apollo estimated_num_employees — feeds the Company Size fit dimension. */
  employeeCount?: number
  /** Apollo annual_revenue — feeds the Funding Stage fit dimension. */
  annualRevenue?: number
  /** The prompt that produced this candidate. Tagged for traceability. */
  prompt: string
  /** Apollo's person ID — useful for re-enrichment later. */
  apolloPersonId?: string
  /** The fit score the candidate received at approval time. */
  fitScore: number
  /**
   * Email of the rep who approved the candidate (becomes assigned_to).
   * The rep who approves owns the outreach.
   */
  approvedBy: string
}

/**
 * Fan an approved prospecting candidate into the `leads` collection.
 *
 * Source = "prospected" (no implied inbound intent — the rep went out and
 * found them via NL ICP search). Tags include `source:prospected` and
 * `apollo:<id>` for traceability + future re-enrichment. The original
 * prompt and fit score get a note line so we can audit which prompts
 * produce conversion-worthy leads over time.
 *
 * Idempotent: if the email already exists in `leads`, we backfill missing
 * fields (title/company/linkedin/location/industry) and append the prompt
 * trace to the notes — same history-preserving rule as PartnerList capture.
 *
 * Same fail-safe shape as the other captureLeadFrom* helpers: returns
 * `{ leadId: null, created: false }` on internal errors so a bulk approval
 * can keep going row-by-row.
 */
export async function captureLeadFromProspecting(
  input: ProspectingCapture,
): Promise<{ leadId: string | null; created: boolean }> {
  try {
    const email = input.email.trim().toLowerCase()
    if (!email) return { leadId: null, created: false }

    const fullName =
      `${input.firstName ?? ""} ${input.lastName ?? ""}`.trim() || email
    const location =
      [input.city, input.state].filter(Boolean).join(", ") || undefined
    const stamp = new Date().toISOString().split("T")[0]
    const noteLine = `[${stamp}] Prospected via ICP search: "${input.prompt}". Fit score ${input.fitScore}.`

    const captureTags = ["source:prospected"]
    if (input.apolloPersonId) {
      captureTags.push(makeTag("client", `apollo-${input.apolloPersonId}`))
    }

    const existing = await findLeadByEmail(email)

    if (existing) {
      const tags = Array.from(
        new Set([...normalizeLegacyTags(existing.tags), ...captureTags]),
      )
      // Backfill-only — never overwrite existing field values, only fill
      // blanks. Same rule as PartnerList + EventRegistration captures.
      const patch: Parameters<typeof updateLead>[1] = {
        tags,
        notes: [existing.notes, noteLine].filter(Boolean).join("\n\n"),
      }
      if (!existing.title && input.title) patch.title = input.title
      if (!existing.company && input.company) patch.company = input.company
      if (!existing.linkedin && input.linkedin) patch.linkedin = input.linkedin
      if (!existing.location && location) patch.location = location
      if (!existing.industry && input.industry) patch.industry = input.industry
      if (!existing.employee_count && input.employeeCount) patch.employee_count = input.employeeCount
      if (!existing.annual_revenue && input.annualRevenue) patch.annual_revenue = input.annualRevenue
      // Don't touch assigned_to — original assignment wins.
      await updateLead(existing.id, patch)
      return { leadId: existing.id, created: false }
    }

    const lead = await createLead({
      name: fullName,
      company: input.company || "",
      title: input.title,
      email,
      linkedin: input.linkedin,
      industry: input.industry,
      location,
      employee_count: input.employeeCount,
      annual_revenue: input.annualRevenue,
      source: "prospected",
      assigned_to: input.approvedBy,
      tags: captureTags,
      notes: noteLine,
      created_by: input.approvedBy,
    })
    return { leadId: lead.id, created: true }
  } catch (err) {
    console.error("[captureLeadFromProspecting] swallowed error:", err)
    return { leadId: null, created: false }
  }
}

/**
 * Increment engagement counters from Resend webhook. Re-scores via updateLead
 * so the engagement bonus kicks in once thresholds are crossed.
 */
export async function incrementEngagement(
  resendEmailId: string,
  field: "email_opens" | "email_clicks",
): Promise<{ leadId: string; newCount: number } | null> {
  const db = getDb()
  const snap = await db
    .collection(COLLECTION)
    .where("resend_email_id", "==", resendEmailId)
    .limit(1)
    .get()
  if (snap.empty) return null

  const ref = snap.docs[0].ref
  await ref.update({ [field]: FieldValue.increment(1), updated_at: new Date().toISOString() })

  // Re-score after the increment
  const after = await ref.get()
  const updated = normalize(ref.id, after.data() ?? {})
  const scored = scoreLead({
    location: updated.location,
    industry: updated.industry,
    title: updated.title,
    company: updated.company,
    employee_count: updated.employee_count,
    annual_revenue: updated.annual_revenue,
    source: updated.source,
    email_opens: updated.email_opens,
    email_clicks: updated.email_clicks,
    tags: updated.tags,
  })
  await ref.update({
    score: scored.score,
    priority: scored.priority,
    score_breakdown: scored.breakdown,
    icp_fit_score: scored.icp_fit_score,
    icp_grade: scored.icp_grade,
    icp_breakdown: scored.icp_breakdown,
    intent_score: scored.intent_score,
    intent_breakdown: scored.intent_breakdown,
    enriched_at: new Date().toISOString(),
  })
  invalidate()

  return { leadId: ref.id, newCount: updated[field] }
}
