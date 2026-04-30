import { getDb } from "./firebase-admin"
import { getClientById, getOpportunitiesByClient } from "./firestore-crm"
import type { ClientRecord, Opportunity } from "../types/crm-types"

// ============================================
// TYPES
// ============================================

export interface MailchimpSubscriberJoin {
  audienceId: string
  audienceName: string
  email: string
  status: string
  tags: Array<{ id: number; name: string }>
  stats: Record<string, unknown> | null
  timestampSignup: string | null
  lastChanged: string | null
  source: string | null
}

export interface EmailSignupJoin {
  id: string
  email: string
  source: string
  created_at: string
  mailchimp_synced?: boolean
  mailchimp_tags?: string[]
  page_url?: string
}

export interface ContactFormJoin {
  id: string
  email: string
  firstName: string
  lastName: string
  company: string
  message?: string
  source: string
  created_at: string
}

export type TimelineEntryKind =
  | "email_signup"
  | "contact_form"
  | "opportunity_created"
  | "opportunity_stage_change"
  | "opportunity_won"
  | "opportunity_lost"
  | "mailchimp_signup"
  | "client_created"

export interface TimelineEntry {
  kind: TimelineEntryKind
  at: string
  title: string
  detail?: string
  source?: string
  meta?: Record<string, unknown>
}

export interface Customer360 {
  client: ClientRecord
  emails: string[]
  summary: {
    opportunitiesOpen: number
    opportunitiesWon: number
    opportunitiesLost: number
    pipelineValue: number
    wonValue: number
    emailSignupCount: number
    contactFormCount: number
    mailchimpSubscriptions: number
    firstSeen: string | null
    lastTouch: string | null
  }
  opportunities: Opportunity[]
  mailchimpSubscribers: MailchimpSubscriberJoin[]
  emailSignups: EmailSignupJoin[]
  contactForms: ContactFormJoin[]
  timeline: TimelineEntry[]
  warnings: string[]
}

// ============================================
// HELPERS
// ============================================

function collectEmails(client: ClientRecord): string[] {
  const set = new Set<string>()
  if (client.email) set.add(client.email.toLowerCase().trim())
  for (const c of client.contacts ?? []) {
    if (c.email) set.add(c.email.toLowerCase().trim())
  }
  return [...set].filter((e) => e.length > 0)
}

async function fetchInChunks<T>(
  emails: string[],
  fn: (chunk: string[]) => Promise<T[]>,
): Promise<T[]> {
  // Firestore `in` queries support up to 30 values
  const out: T[] = []
  for (let i = 0; i < emails.length; i += 30) {
    const chunk = emails.slice(i, i + 30)
    out.push(...(await fn(chunk)))
  }
  return out
}

// ============================================
// JOIN FETCHERS
// ============================================

async function fetchMailchimpSubscribers(emails: string[]): Promise<MailchimpSubscriberJoin[]> {
  if (emails.length === 0) return []
  const db = getDb()
  return fetchInChunks(emails, async (chunk) => {
    const snap = await db
      .collection("mailchimp_subscribers")
      .where("email", "in", chunk)
      .get()
    return snap.docs.map((d) => {
      const data = d.data()
      return {
        audienceId: data.audienceId ?? "",
        audienceName: data.audienceName ?? "",
        email: data.email ?? "",
        status: data.status ?? "unknown",
        tags: data.tags ?? [],
        stats: data.stats ?? null,
        timestampSignup: data.timestampSignup ?? null,
        lastChanged: data.lastChanged ?? null,
        source: data.source ?? null,
      } satisfies MailchimpSubscriberJoin
    })
  })
}

async function fetchEmailSignups(emails: string[]): Promise<EmailSignupJoin[]> {
  if (emails.length === 0) return []
  const db = getDb()
  return fetchInChunks(emails, async (chunk) => {
    const snap = await db.collection("email_signups").where("email", "in", chunk).get()
    return snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        email: data.email ?? "",
        source: data.source ?? "unknown",
        created_at: data.created_at ?? "",
        mailchimp_synced: data.mailchimp_synced,
        mailchimp_tags: data.mailchimp_tags,
        page_url: data.page_url,
      } satisfies EmailSignupJoin
    })
  })
}

async function fetchContactForms(emails: string[]): Promise<ContactFormJoin[]> {
  if (emails.length === 0) return []
  const db = getDb()
  return fetchInChunks(emails, async (chunk) => {
    const snap = await db.collection("contact_forms").where("email", "in", chunk).get()
    return snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        email: data.email ?? "",
        firstName: data.firstName ?? "",
        lastName: data.lastName ?? "",
        company: data.company ?? "",
        message: data.message,
        source: data.source ?? "unknown",
        created_at: data.created_at ?? "",
      } satisfies ContactFormJoin
    })
  })
}

// ============================================
// TIMELINE ASSEMBLY
// ============================================

function buildTimeline(
  client: ClientRecord,
  opportunities: Opportunity[],
  emailSignups: EmailSignupJoin[],
  contactForms: ContactFormJoin[],
  mailchimpSubscribers: MailchimpSubscriberJoin[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = []

  if (client.created_at) {
    entries.push({
      kind: "client_created",
      at: client.created_at,
      title: `Added to CRM as ${client.status}`,
      source: client.lead_source,
    })
  }

  for (const o of opportunities) {
    if (o.created_at) {
      entries.push({
        kind: "opportunity_created",
        at: o.created_at,
        title: `Opportunity created — ${o.stage}`,
        detail: o.value ? `$${o.value.toLocaleString()}` : undefined,
        meta: { opportunityId: o.id, stage: o.stage },
      })
    }
    if (o.stage === "closed_won" && o.actual_close_date) {
      entries.push({
        kind: "opportunity_won",
        at: o.actual_close_date,
        title: "Deal won",
        detail: o.value ? `$${o.value.toLocaleString()}` : undefined,
        meta: { opportunityId: o.id, won_reason: o.won_reason },
      })
    }
    if (o.stage === "closed_lost" && o.actual_close_date) {
      entries.push({
        kind: "opportunity_lost",
        at: o.actual_close_date,
        title: "Deal lost",
        detail: o.lost_reason,
        meta: { opportunityId: o.id, lost_reason: o.lost_reason },
      })
    }
  }

  for (const s of emailSignups) {
    entries.push({
      kind: "email_signup",
      at: s.created_at,
      title: `Email signup — ${s.source}`,
      detail: s.email,
      source: s.source,
      meta: { tags: s.mailchimp_tags, page: s.page_url },
    })
  }

  for (const f of contactForms) {
    entries.push({
      kind: "contact_form",
      at: f.created_at,
      title: `Contact form — ${f.source}`,
      detail: f.message ? f.message.slice(0, 140) : f.email,
      source: f.source,
      meta: { company: f.company, name: `${f.firstName} ${f.lastName}`.trim() },
    })
  }

  for (const m of mailchimpSubscribers) {
    if (m.timestampSignup) {
      entries.push({
        kind: "mailchimp_signup",
        at: m.timestampSignup,
        title: `Subscribed to ${m.audienceName}`,
        detail: m.status,
        source: m.source ?? undefined,
        meta: { tags: m.tags?.map((t) => t.name) },
      })
    }
  }

  return entries
    .filter((e) => !!e.at)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
}

// ============================================
// MAIN ORCHESTRATOR
// ============================================

export async function getCustomer360(clientId: string): Promise<Customer360 | null> {
  const client = await getClientById(clientId)
  if (!client) return null

  const emails = collectEmails(client)
  const warnings: string[] = []
  if (emails.length === 0) {
    warnings.push("No email addresses on this client — engagement joins skipped")
  }

  const [opportunities, mailchimpSubscribers, emailSignups, contactForms] = await Promise.all([
    getOpportunitiesByClient(clientId).catch((err) => {
      warnings.push(`opportunities query failed: ${err instanceof Error ? err.message : err}`)
      return [] as Opportunity[]
    }),
    fetchMailchimpSubscribers(emails).catch((err) => {
      warnings.push(`mailchimp join failed: ${err instanceof Error ? err.message : err}`)
      return [] as MailchimpSubscriberJoin[]
    }),
    fetchEmailSignups(emails).catch((err) => {
      warnings.push(`email_signups join failed: ${err instanceof Error ? err.message : err}`)
      return [] as EmailSignupJoin[]
    }),
    fetchContactForms(emails).catch((err) => {
      warnings.push(`contact_forms join failed: ${err instanceof Error ? err.message : err}`)
      return [] as ContactFormJoin[]
    }),
  ])

  const timeline = buildTimeline(client, opportunities, emailSignups, contactForms, mailchimpSubscribers)

  const opportunitiesOpen = opportunities.filter(
    (o) => o.stage !== "closed_won" && o.stage !== "closed_lost",
  ).length
  const opportunitiesWon = opportunities.filter((o) => o.stage === "closed_won").length
  const opportunitiesLost = opportunities.filter((o) => o.stage === "closed_lost").length
  const pipelineValue = opportunities
    .filter((o) => o.stage !== "closed_won" && o.stage !== "closed_lost")
    .reduce((sum, o) => sum + (o.value ?? 0), 0)
  const wonValue = opportunities
    .filter((o) => o.stage === "closed_won")
    .reduce((sum, o) => sum + (o.value ?? 0), 0)

  const allDates = timeline.map((e) => e.at).filter(Boolean) as string[]
  const firstSeen = allDates.length > 0 ? allDates[allDates.length - 1] : null
  const lastTouch = allDates.length > 0 ? allDates[0] : null

  return {
    client,
    emails,
    summary: {
      opportunitiesOpen,
      opportunitiesWon,
      opportunitiesLost,
      pipelineValue,
      wonValue,
      emailSignupCount: emailSignups.length,
      contactFormCount: contactForms.length,
      mailchimpSubscriptions: mailchimpSubscribers.length,
      firstSeen,
      lastTouch,
    },
    opportunities,
    mailchimpSubscribers,
    emailSignups,
    contactForms,
    timeline,
    warnings,
  }
}
