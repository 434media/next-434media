import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { createLead, findLeadByEmail, updateLead } from "@/lib/firestore-leads"
import {
  getPartnerListMember,
  markPartnerListMemberPromoted,
} from "@/lib/firestore-partner-list-members"
import {
  getEventRegistrationById,
  markEventRegistrationPromoted,
} from "@/lib/firestore-event-registrations"
import {
  getEmailSignupById,
  markEmailSignupPromoted,
} from "@/lib/firestore-email-signups"
import {
  getContactFormById,
  markContactFormPromoted,
} from "@/lib/firestore-contact-forms"
import type { LeadSource } from "@/types/crm-types"

export const runtime = "nodejs"
export const maxDuration = 300

/**
 * POST /api/admin/leads/promote-from-audience
 *
 * Promotes one or more audience-side records into the leads pipeline.
 * Idempotent — already-promoted records are detected by their backlink
 * field and surfaced as `linked` outcomes (no duplicate Lead created).
 *
 * v1 supports `partner_list_members` only. Adding event_registrations,
 * email_signups, contact_forms is mechanical: define the source mapping +
 * write the equivalent of markPartnerListMemberPromoted for that collection.
 *
 * Body:
 *   {
 *     collection: "partner_list_members",
 *     ids: ["abc123", "def456"],
 *     overrideSource?: LeadSource,  // defaults to the collection's natural source
 *     extraTags?: string[],         // appended to each new Lead's tags (already-namespaced)
 *     noteAddendum?: string         // appended to each new Lead's notes
 *   }
 *
 * Response:
 *   { ok: true, outcomes: [{ id, status, leadId?, error? }] }
 *   status: "created" | "linked" | "already-promoted" | "not-found" | "failed"
 */

type AudienceCollection =
  | "partner_list_members"
  | "event_registrations"
  | "email_signups"
  | "contact_forms"

const SUPPORTED_COLLECTIONS = new Set<AudienceCollection>([
  "partner_list_members",
  "event_registrations",
  "email_signups",
  "contact_forms",
])

const COLLECTION_DEFAULT_SOURCE: Record<AudienceCollection, LeadSource> = {
  partner_list_members: "partner",
  event_registrations: "event",
  email_signups: "newsletter",
  contact_forms: "web",
}

interface PromoteOutcome {
  id: string
  status: "created" | "linked" | "already-promoted" | "not-found" | "failed"
  leadId?: string
  error?: string
}

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const collection = body.collection as AudienceCollection
  const ids = Array.isArray(body.ids) ? (body.ids as string[]).filter((s) => typeof s === "string") : []
  const overrideSource = typeof body.overrideSource === "string" ? (body.overrideSource as LeadSource) : undefined
  const extraTags = Array.isArray(body.extraTags)
    ? (body.extraTags as unknown[]).filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    : []
  const noteAddendum = typeof body.noteAddendum === "string" ? body.noteAddendum.trim() : ""

  if (!collection) {
    return NextResponse.json({ error: "collection is required" }, { status: 400 })
  }
  if (!SUPPORTED_COLLECTIONS.has(collection)) {
    return NextResponse.json(
      {
        error: `collection '${collection}' is not yet supported by promote-from-audience. Supported: ${[...SUPPORTED_COLLECTIONS].join(", ")}`,
      },
      { status: 400 },
    )
  }
  if (ids.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 })
  }
  if (ids.length > 500) {
    return NextResponse.json({ error: "ids array is capped at 500 per request" }, { status: 400 })
  }

  const source = overrideSource ?? COLLECTION_DEFAULT_SOURCE[collection]
  const outcomes: PromoteOutcome[] = []

  for (const id of ids) {
    try {
      const outcome = await promoteOne(collection, id, source, auth.session.email, {
        extraTags,
        noteAddendum,
      })
      outcomes.push(outcome)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      console.error("[promote-from-audience] item failed:", collection, id, err)
      outcomes.push({ id, status: "failed", error: message })
    }
  }

  const summary = {
    created: outcomes.filter((o) => o.status === "created").length,
    linked: outcomes.filter((o) => o.status === "linked").length,
    alreadyPromoted: outcomes.filter((o) => o.status === "already-promoted").length,
    notFound: outcomes.filter((o) => o.status === "not-found").length,
    failed: outcomes.filter((o) => o.status === "failed").length,
  }

  console.log(
    `[promote-from-audience] ${auth.session.email} (${collection})`,
    JSON.stringify({ requested: ids.length, ...summary }),
  )

  return NextResponse.json({ ok: true, summary, outcomes })
}

interface PromoteOverrides {
  extraTags: string[]
  noteAddendum: string
}

async function promoteOne(
  collection: AudienceCollection,
  id: string,
  source: LeadSource,
  actorEmail: string,
  overrides: PromoteOverrides,
): Promise<PromoteOutcome> {
  if (collection === "partner_list_members") {
    return promoteFromPartnerListMember(id, source, actorEmail, overrides)
  }
  if (collection === "event_registrations") {
    return promoteFromEventRegistration(id, source, actorEmail, overrides)
  }
  if (collection === "email_signups") {
    return promoteFromEmailSignup(id, source, actorEmail, overrides)
  }
  if (collection === "contact_forms") {
    return promoteFromContactForm(id, source, actorEmail, overrides)
  }
  // Defensive: SUPPORTED_COLLECTIONS gates this above, but TypeScript can't
  // prove exhaustiveness here without a never-cast.
  return { id, status: "failed", error: `Unsupported collection: ${collection}` }
}

// Apply override extras to a base tag set + a base notes string. Used by every
// promoteFromX function so tag merging + note-appending happens identically.
function applyOverrides(
  baseTags: string[],
  baseNotes: string,
  overrides: PromoteOverrides,
): { tags: string[]; notes: string } {
  const tags = Array.from(new Set([...baseTags, ...overrides.extraTags]))
  const notes = overrides.noteAddendum
    ? [baseNotes, overrides.noteAddendum].filter(Boolean).join("\n\n")
    : baseNotes
  return { tags, notes }
}

async function promoteFromPartnerListMember(
  memberId: string,
  source: LeadSource,
  actorEmail: string,
  overrides: PromoteOverrides,
): Promise<PromoteOutcome> {
  const member = await getPartnerListMember(memberId)
  if (!member) return { id: memberId, status: "not-found" }

  // Already promoted — surface the existing leadId without doing anything.
  if (member.promotedLeadId) {
    return { id: memberId, status: "already-promoted", leadId: member.promotedLeadId }
  }

  const email = member.email.trim().toLowerCase()
  if (!email) {
    return { id: memberId, status: "failed", error: "Member has no email" }
  }

  // Provenance — preserved on the Lead so the CRM can show "from Alamo
  // Angels list, promoted 2026-05-08".
  const originRef = {
    collection: "partner_list_members" as const,
    id: memberId,
    promoted_at: new Date().toISOString(),
  }

  const existing = await findLeadByEmail(email)
  if (existing) {
    // Lead already exists from another source — link the audience record
    // to it without creating a duplicate. Backfill origin_ref if absent so
    // the CRM gains the partner provenance even when the lead pre-existed.
    if (!existing.origin_ref) {
      await updateLead(existing.id, { origin_ref: originRef })
    }
    await markPartnerListMemberPromoted(memberId, existing.id)
    return { id: memberId, status: "linked", leadId: existing.id }
  }

  // Capture the partner provenance into tags so it shows up in CRM searches
  // and Mailchimp pushes naturally.
  const baseTags = Array.from(
    new Set([
      `source:${source}`,
      member.partnerSlug ? `partner:${member.partnerSlug}` : null,
      ...(member.tags ?? []).filter((t) => t !== "source:partner"),
    ]).values(),
  ).filter((t): t is string => !!t)

  // Promotion notes — preserve the import history + add a promote receipt.
  const promoteLine = `[${new Date().toISOString().split("T")[0]}] Promoted from ${member.partnerName} list by ${actorEmail}`
  const baseNotes = [member.notes, promoteLine].filter(Boolean).join("\n\n")
  const { tags, notes } = applyOverrides(baseTags, baseNotes, overrides)

  const newLead = await createLead({
    name: member.fullName || email,
    company: member.company || "",
    email,
    phone: member.phone,
    linkedin: member.linkedin,
    source,
    tags,
    notes,
    origin_ref: originRef,
    created_by: `promote-from-${originRef.collection}`,
  })

  await markPartnerListMemberPromoted(memberId, newLead.id)
  return { id: memberId, status: "created", leadId: newLead.id }
}

async function promoteFromEventRegistration(
  registrationId: string,
  source: LeadSource,
  actorEmail: string,
  overrides: PromoteOverrides,
): Promise<PromoteOutcome> {
  const reg = await getEventRegistrationById(registrationId)
  if (!reg) return { id: registrationId, status: "not-found" }

  if (reg.promotedLeadId) {
    return { id: registrationId, status: "already-promoted", leadId: reg.promotedLeadId }
  }

  const email = reg.email.trim().toLowerCase()
  if (!email) return { id: registrationId, status: "failed", error: "Registration has no email" }

  const originRef = {
    collection: "event_registrations" as const,
    id: registrationId,
    promoted_at: new Date().toISOString(),
  }

  const existing = await findLeadByEmail(email)
  if (existing) {
    if (!existing.origin_ref) {
      await updateLead(existing.id, { origin_ref: originRef })
    }
    await markEventRegistrationPromoted(registrationId, existing.id)
    return { id: registrationId, status: "linked", leadId: existing.id }
  }

  // Roll the event-specific tags (event:<slug>, role:*) through to the Lead so
  // CRM searches like "show me everyone from SA Tech Day 2026" still work.
  const baseTags = Array.from(
    new Set([`source:${source}`, ...(reg.tags ?? [])].filter(Boolean)),
  )

  const promoteLine = `[${new Date().toISOString().split("T")[0]}] Promoted from event registration (${reg.eventName || reg.event}) by ${actorEmail}`
  const { tags, notes } = applyOverrides(baseTags, promoteLine, overrides)

  const newLead = await createLead({
    name: reg.fullName || `${reg.firstName ?? ""} ${reg.lastName ?? ""}`.trim() || email,
    company: reg.company || "",
    email,
    source,
    tags,
    notes,
    origin_ref: originRef,
    created_by: `promote-from-${originRef.collection}`,
  })

  await markEventRegistrationPromoted(registrationId, newLead.id)
  return { id: registrationId, status: "created", leadId: newLead.id }
}

async function promoteFromEmailSignup(
  signupId: string,
  source: LeadSource,
  actorEmail: string,
  overrides: PromoteOverrides,
): Promise<PromoteOutcome> {
  const signup = await getEmailSignupById(signupId)
  if (!signup) return { id: signupId, status: "not-found" }

  if (signup.promotedLeadId) {
    return { id: signupId, status: "already-promoted", leadId: signup.promotedLeadId }
  }

  const email = signup.email.trim().toLowerCase()
  if (!email) return { id: signupId, status: "failed", error: "Signup has no email" }

  const originRef = {
    collection: "email_signups" as const,
    id: signupId,
    promoted_at: new Date().toISOString(),
  }

  const existing = await findLeadByEmail(email)
  if (existing) {
    if (!existing.origin_ref) {
      await updateLead(existing.id, { origin_ref: originRef })
    }
    await markEmailSignupPromoted(signupId, existing.id)
    return { id: signupId, status: "linked", leadId: existing.id }
  }

  // Newsletter signups are sparse — usually just email + signup source. The
  // resulting Lead carries the source tag and signup-source as a note so a rep
  // can enrich via Apollo or a manual lookup before working it.
  const baseTags = Array.from(
    new Set([`source:${source}`, signup.source ? `signup-source:${signup.source}` : null]),
  ).filter((t): t is string => !!t)

  const promoteLine = `[${new Date().toISOString().split("T")[0]}] Promoted from newsletter signup (${signup.source}) by ${actorEmail}`
  const { tags, notes } = applyOverrides(baseTags, promoteLine, overrides)

  const newLead = await createLead({
    name: email, // No name on signup; rep can rename in CRM.
    company: "",
    email,
    source,
    tags,
    notes,
    origin_ref: originRef,
    created_by: `promote-from-${originRef.collection}`,
  })

  await markEmailSignupPromoted(signupId, newLead.id)
  return { id: signupId, status: "created", leadId: newLead.id }
}

async function promoteFromContactForm(
  formId: string,
  source: LeadSource,
  actorEmail: string,
  overrides: PromoteOverrides,
): Promise<PromoteOutcome> {
  const form = await getContactFormById(formId)
  if (!form) return { id: formId, status: "not-found" }

  if (form.promotedLeadId) {
    return { id: formId, status: "already-promoted", leadId: form.promotedLeadId }
  }

  const email = form.email.trim().toLowerCase()
  if (!email) return { id: formId, status: "failed", error: "Form has no email" }

  const originRef = {
    collection: "contact_forms" as const,
    id: formId,
    promoted_at: new Date().toISOString(),
  }

  const existing = await findLeadByEmail(email)
  if (existing) {
    if (!existing.origin_ref) {
      await updateLead(existing.id, { origin_ref: originRef })
    }
    await markContactFormPromoted(formId, existing.id)
    return { id: formId, status: "linked", leadId: existing.id }
  }

  const fullName = `${form.firstName ?? ""} ${form.lastName ?? ""}`.trim() || email
  const baseTags = [
    `source:${source}`,
    form.source ? `inbox-source:${form.source}` : null,
  ].filter((t): t is string => !!t)

  // Carry the original message into notes so the rep has context — that's the
  // whole point of promoting from inbox vs. just replying.
  const lines = [
    `[${new Date().toISOString().split("T")[0]}] Promoted from contact form (${form.source}) by ${actorEmail}`,
  ]
  if (form.message) lines.push(`---\n${form.message.trim()}`)
  const baseNotes = lines.join("\n\n")
  const { tags, notes } = applyOverrides(baseTags, baseNotes, overrides)

  const newLead = await createLead({
    name: fullName,
    company: form.company || "",
    email,
    phone: form.phone,
    source,
    tags,
    notes,
    origin_ref: originRef,
    created_by: `promote-from-${originRef.collection}`,
  })

  await markContactFormPromoted(formId, newLead.id)
  return { id: formId, status: "created", leadId: newLead.id }
}
