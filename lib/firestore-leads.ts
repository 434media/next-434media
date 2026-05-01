import { Timestamp, FieldValue } from "firebase-admin/firestore"
import { getDb } from "./firebase-admin"
import { scoreLead } from "./score-lead"
import { trackLeadCapture, trackLeadQualified } from "./ga4-events"
import {
  CRM_COLLECTIONS,
  type Lead,
  type LeadCreateInput,
  type LeadStatus,
  type LeadUpdateInput,
} from "../types/crm-types"

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
    status: (raw.status || "new") as LeadStatus,
    assigned_to: raw.assigned_to || undefined,
    outreach_draft: raw.outreach_draft || undefined,
    draft_generated_at: toIsoString(raw.draft_generated_at) || undefined,
    last_contacted_at: toIsoString(raw.last_contacted_at) || undefined,
    next_followup_date: toIsoString(raw.next_followup_date) || undefined,
    resend_email_id: raw.resend_email_id || undefined,
    email_opens: typeof raw.email_opens === "number" ? raw.email_opens : 0,
    email_clicks: typeof raw.email_clicks === "number" ? raw.email_clicks : 0,
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : undefined,
    notes: raw.notes || undefined,
    created_by: raw.created_by || undefined,
    enriched_at: toIsoString(raw.enriched_at) || undefined,
    converted_to_client_id: raw.converted_to_client_id || undefined,
    converted_at: toIsoString(raw.converted_at) || undefined,
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
  const { score, priority, breakdown } = scoreLead({
    location: input.location,
    industry: input.industry,
    title: input.title,
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
    score,
    priority,
    score_breakdown: breakdown,
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
    created_by: input.created_by ?? null,
    enriched_at: now,
    converted_to_client_id: null,
    converted_at: null,
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
  const { score, priority, breakdown } = scoreLead({
    location: merged.location,
    industry: merged.industry,
    title: merged.title,
    source: merged.source,
    email_opens: merged.email_opens,
    email_clicks: merged.email_clicks,
    tags: merged.tags,
  })

  const update: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
    ...patch,
    score,
    priority,
    score_breakdown: breakdown,
    enriched_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  // Normalize email casing if it's being changed
  if (typeof patch.email === "string") {
    update.email = patch.email.trim().toLowerCase()
  }

  await ref.update(update)
  invalidate()
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
    const sourceTag = `form:${input.source.toLowerCase()}`

    if (existing) {
      const tags = Array.from(new Set([...(existing.tags ?? []), sourceTag]))
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
      tags: [sourceTag],
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
    const sourceTag = `newsletter:${input.source.toLowerCase()}`
    const incomingTags = (input.tags ?? []).map((t) => t.toLowerCase())

    if (existing) {
      const tags = Array.from(
        new Set([...(existing.tags ?? []), sourceTag, ...incomingTags]),
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
      tags: [sourceTag, ...incomingTags],
    })
    return { leadId: lead.id, created: true }
  } catch (err) {
    console.error("[captureLeadFromEmailSignup] swallowed error:", err)
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
  const { score, priority, breakdown } = scoreLead({
    location: updated.location,
    industry: updated.industry,
    title: updated.title,
    source: updated.source,
    email_opens: updated.email_opens,
    email_clicks: updated.email_clicks,
    tags: updated.tags,
  })
  await ref.update({
    score,
    priority,
    score_breakdown: breakdown,
    enriched_at: new Date().toISOString(),
  })
  invalidate()

  return { leadId: ref.id, newCount: updated[field] }
}
