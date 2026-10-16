import { aiDisclosureRequired, apiLabelSupported, checkReviewedFormat, META_AI_DISCLOSURE_RULE } from "./owned-meta-formats"
import type { MetaConnectionReport } from "./owned-meta-connection"
import { assertApproved, MetaBlocked, type MetaBatch, type MetaDestination, type MetaManifest, type MetaRecord } from "./owned-meta-publisher"

/**
 * Narrow machine surface over the existing publisher (Slack executor, crons).
 * Pure helpers only: no environment, storage or network access here.
 */

export interface OwnedMetaNotice { feature: string; status: "unsupported" | "not_applied"; detail: string }

/** Optional features the API path does not perform. Reported, never blocking. */
export function noticesFor(m: MetaManifest): OwnedMetaNotice[] {
  const notices: OwnedMetaNotice[] = [
    { feature: "account_tagging", status: "unsupported", detail: "Native account/company tags are not applied by the API publisher; a caption @mention is not a tag. Add tags natively after publication if wanted." },
    { feature: "stories", status: "unsupported", detail: "Story resharing is not performed by the API publisher." },
  ]
  // Unsupported labels are reported, never added to the approved caption and never blocking.
  const wantsLabel = m.aiGenerated || aiDisclosureRequired(m)
  for (const d of ["instagram", "facebook"] as const) {
    if (wantsLabel && !apiLabelSupported(m, d) && !aiDisclosureRequired(m)) notices.push({ feature: `${d}_ai_label`, status: "not_applied", detail: `Meta documents no AI label parameter for this ${d === "facebook" ? "Facebook Page post type" : "placement"}; it publishes with the approved caption unchanged. Meta's self-disclosure requirement covers ${META_AI_DISCLOSURE_RULE.appliesTo.toLowerCase()}, which this post is not declared to be.` })
  }
  return notices
}

/** Format/account holds per destination, computed before approval binds the files. */
export function preflightFor(m: MetaManifest): Record<MetaDestination, string | null> {
  return { instagram: checkReviewedFormat(m, "instagram"), facebook: checkReviewedFormat(m, "facebook") }
}

/**
 * Owner-reported publication made outside the publisher (e.g. a manual post).
 * Records it so no run can publish that destination; it never dispatches anything.
 * Only an untouched job qualifies: an attempt with a final intent uses manual-confirm.
 */
export function recordExternalPublication(record: MetaRecord, destination: MetaDestination, input: { permalink: string; remoteId?: string; actor: string; evidence: string; at: string }): void {
  if (record.batch.claim) throw new MetaBlocked("Wait for the active run to stop before recording an external publication")
  const j = record.batch.jobs[destination]
  if (j.finalIntent || j.retry || j.remoteId || j.manualEvidence || ["verified", "operator_confirmed", "final_started", "needs_reconciliation"].includes(j.status)) throw new MetaBlocked("This destination has a publisher attempt or result; use reconcile or manual-confirm")
  const url = permalinkFor(destination, input.permalink)
  if (input.remoteId && !/^\d+(?:_\d+)?$/.test(input.remoteId)) throw new MetaBlocked("Remote ID must be numeric")
  if (!input.actor || input.evidence.trim().length < 20 || input.evidence.length > 2000) throw new MetaBlocked("Observation evidence (20–2,000 characters) and actor required")
  record.batch.jobs[destination] = {
    status: "operator_confirmed", preparation: j.preparation, permalink: url, verifiedAt: input.at,
    ...(input.remoteId ? { remoteId: input.remoteId } : {}),
    manualEvidence: { by: input.actor, at: input.at, approvedHash: record.batch.hash, confirmation: `Owner-reported external publication, not API verification: ${input.evidence.trim()}` },
  }
}

export function permalinkFor(destination: MetaDestination, raw: string): string {
  let url: URL
  try { url = new URL(raw) } catch { throw new MetaBlocked("Platform permalink required") }
  const host = destination === "instagram" ? "instagram.com" : "facebook.com"
  if (url.protocol !== "https:" || ![host, `www.${host}`].includes(url.hostname) || url.username || url.password) throw new MetaBlocked("Platform permalink required")
  url.search = ""; url.hash = ""
  return url.toString()
}

/**
 * A continuation only resumes preparation that Meta is still processing.
 * Any recorded final intent is excluded, so a continuation can never repeat a final publish.
 */
export function needsContinuation(record: MetaRecord): MetaDestination[] {
  try { assertApproved(record) } catch { return [] }
  if (record.batch.claim) return []
  return (["instagram", "facebook"] as const).filter(d => { const j = record.batch.jobs[d]; return j.status === "processing" && !j.finalIntent && !j.retry })
}

export interface OwnedMetaResult { destination: MetaDestination; status: string; evidence: "api_verified" | "owner_reported" | "none"; remoteId?: string; permalink?: string; verifiedAt?: string; blocker?: string; doNotRepeat: boolean }
export function summarize(batch: MetaBatch): { batchId: string; hash: string; revision: number; approved: boolean; complete: boolean; results: OwnedMetaResult[] } {
  const results = (["instagram", "facebook"] as const).map(d => {
    const j = batch.jobs[d]
    return {
      destination: d, status: j.status,
      evidence: j.status === "verified" ? "api_verified" as const : j.status === "operator_confirmed" ? "owner_reported" as const : "none" as const,
      ...(j.remoteId ? { remoteId: j.remoteId } : {}), ...(j.permalink ? { permalink: j.permalink } : {}), ...(j.verifiedAt ? { verifiedAt: j.verifiedAt } : {}), ...(j.blocker ? { blocker: j.blocker } : {}),
      doNotRepeat: !!j.finalIntent || j.status === "verified" || j.status === "operator_confirmed",
    }
  })
  return { batchId: batch.id, hash: batch.hash, revision: batch.manifest.revision, approved: !!batch.approval && !batch.revoked, complete: results.every(r => r.evidence !== "none"), results }
}

/** Plain text for Slack. Never includes tokens, URLs other than platform permalinks, or vendor messages. */
export function slackText(title: string, batch: MetaBatch, notices: OwnedMetaNotice[]): string {
  const s = summarize(batch)
  const line = (r: OwnedMetaResult) => `• ${r.destination === "instagram" ? "Instagram" : "Facebook"}: ${r.status}${r.evidence === "api_verified" ? " (API verified)" : r.evidence === "owner_reported" ? " (owner-reported)" : ""}${r.remoteId ? ` — ID ${r.remoteId}` : ""}${r.permalink ? ` — ${r.permalink}` : ""}${r.blocker ? ` — ${r.blocker}` : ""}${r.doNotRepeat && r.evidence === "none" ? " — do not repeat" : ""}`
  return [`${title} — revision ${s.revision}, hash ${s.hash.slice(0, 12)}`, ...s.results.map(line), ...notices.map(n => `• Not done: ${n.feature.replace(/_/g, " ")} — ${n.detail}`)].join("\n")
}

/** "U123:person@434media.com,U456:other@434media.com" → Slack user → reviewer email. */
export function parseApprovers(raw: string | undefined): Map<string, string> {
  const map = new Map<string, string>()
  for (const pair of (raw || "").split(",").map(s => s.trim()).filter(Boolean)) {
    const [user, email] = pair.split(":")
    if (/^U[A-Z0-9]{6,}$/.test(user || "") && /^[^\s@]+@434media\.com$/i.test(email || "")) map.set(user, email.toLowerCase())
  }
  return map
}

export interface SlackMessage { ts?: string; user?: string; bot_id?: string; subtype?: string; text?: string }
/**
 * Approval is read from Slack itself, not relayed by the caller: the exact message must be
 * by an allowlisted human, say "approve", and quote the first 12 characters of the hash.
 */
export function slackApprovalFrom(message: SlackMessage | undefined, approvers: Map<string, string>, hash: string): { email: string; user: string } {
  if (!message || message.bot_id || message.subtype || !message.user || typeof message.text !== "string") throw new MetaBlocked("Approval message not found or not written by a person")
  const email = approvers.get(message.user)
  if (!email) throw new MetaBlocked("Approval author is not an authorized approver")
  if (!/\bapprove(d)?\b/i.test(message.text) || !message.text.toLowerCase().includes(hash.slice(0, 12).toLowerCase())) throw new MetaBlocked("Approval must say approve and quote the first 12 characters of the manifest hash")
  return { email, user: message.user }
}

/** 190 = invalid/expired token; 10/200 = permission. A readable account is not proof of publish permission. */
export function credentialState(report: Pick<MetaConnectionReport, "identity" | "relationship" | "facebook" | "instagram">): "expired_or_invalid" | "permission_error" | "readable" | "unverified" {
  const codes = [report.identity, report.relationship, report.facebook, report.instagram].map(c => c.error?.code).filter((c): c is number => typeof c === "number")
  if (codes.includes(190)) return "expired_or_invalid"
  if (codes.some(c => c === 10 || c === 200)) return "permission_error"
  return report.identity.outcome === "readable" && report.relationship.matchesConfigured ? "readable" : "unverified"
}
