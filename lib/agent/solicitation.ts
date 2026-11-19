/**
 * The pre-check before intake's paid draft (founder, 2026-11-19: "no paid drafts for solicitations or spam"). Rules
 * only, so it costs nothing: no model is called here.
 *
 * A solicitation is someone selling to 434 (SEO, lead generation, referral or commission offers, outsourcing), not
 * someone asking 434 to produce something. It is held for the founder with no draft and no reply; his Dismiss is the
 * decision. Everything else, and anything the rules are unsure about, gets the normal draft.
 *
 * Fails open: one seller signal alone is "unsure" and drafts as usual, with the signal recorded on the draft. The
 * rules never key on agency language alone, because "Agency seeking a production partner" is a request type the
 * intake procedure qualifies (master 9.5).
 *
 * Pure. lib/agent/intake-server.ts reads the dismissed senders; lib/agent/intake.ts acts on the result.
 */
import { FREE_MAIL_DOMAINS, normalizeDomain, normalizeEmail } from "../core-model/identity"

/** Senders and company domains the founder dismissed as spam or a solicitation (`intake_dismissed_senders`). */
export const DISMISSED_SENDERS_COLLECTION = "intake_dismissed_senders"

export interface DismissedSenders {
  emails: ReadonlySet<string>
  domains: ReadonlySet<string>
}

/**
 * Seller phrases. Each is something a vendor pitching 434 writes and a prospect asking for a production does not.
 * The codes are short slugs: they go on the ledger and the approval, never the person's words.
 */
export const SOLICITATION_SIGNALS: readonly { code: string; label: string; re: RegExp }[] = [
  { code: "referral-commission", label: "offers a referral fee or commission", re: /\b(referral|finder'?s?)\s+(fee|commission|partnership|program|bonus)s?\b|\bcommissions?\s+(on|for|per)\b|\b\d{1,2}\s?%\s+(commission|of (the )?(revenue|deal|contract))\b/i },
  { code: "seo-ranking", label: "sells SEO or search ranking", re: /\b(seo services|search engine optimi[sz]ation services|rank(ing)? (on|higher on) (the )?(first|1st|top) page|first page of google|backlinks?|guest posts?|domain authority)\b/i },
  { code: "grow-your", label: "promises to grow 434's traffic, leads or sales", re: /\b(increase|boost|grow|double|triple|skyrocket)\s+your\s+(website\s+)?(traffic|leads|sales|revenue|rankings?|followers|conversions|roi)\b/i },
  { code: "lead-gen-offer", label: "offers lead generation or appointment setting", re: /\b(lead generation|appointment setting|qualified (leads|appointments)|b2b leads)\s+(services?|agency|campaigns?|for you|for your)\b|\bwe (can )?(generate|deliver|book) (\d+\s+)?(qualified )?(leads|appointments|meetings)\b/i },
  { code: "outsourcing-offer", label: "offers outsourced or offshore staff", re: /\b(offshore|outsourc(e|ed|ing)|white[- ]label (seo|ppc|marketing|development) services|virtual assistants?|dedicated developers?)\b/i },
  { code: "free-audit", label: "offers a free audit or trial", re: /\bfree\s+(seo |website |marketing |site )?(audit|analysis|trial|report|mock-?up)\b/i },
  { code: "we-help-agencies", label: "pitches a service to agencies like 434", re: /\b(we|our (team|agency|company))\s+(help|helps|work with|partner with)\s+(agencies|companies like yours|businesses like yours|media companies like)\b/i },
  { code: "bulk-mail", label: "reads like bulk mail", re: /\b(unsubscribe|reply (with )?["“]?(stop|remove|no)["”]?\s+to\s+(opt[- ]out|unsubscribe|stop)|opt[- ]out)\b/i },
]

/** Two different seller signals hold the arrival; one alone is unsure and drafts as usual. */
export const HOLD_AT_SIGNALS = 2

export type Precheck =
  | { hold: true; why: "dismissed-sender" | "dismissed-domain" | "solicitation"; signals: string[] }
  | { hold: false; signals: string[] }

export interface PrecheckInput {
  email: string
  company?: string
  requestType?: string
  message?: string
}

/** The sender's company domain, or "" for a free-mail or unusable address (one Gmail user never blocks Gmail). */
export function senderDomain(email: string): string {
  const e = normalizeEmail(email)
  const d = e ? normalizeDomain(e.split("@")[1]) : ""
  return d && !FREE_MAIL_DOMAINS.has(d) ? d : ""
}

export function precheckArrival(input: PrecheckInput, dismissed: DismissedSenders): Precheck {
  const email = normalizeEmail(input.email)
  const domain = senderDomain(input.email)
  const text = [input.company, input.requestType, input.message].filter(Boolean).join("\n")
  const signals = SOLICITATION_SIGNALS.filter((s) => s.re.test(text)).map((s) => s.code)
  if (email && dismissed.emails.has(email)) return { hold: true, why: "dismissed-sender", signals }
  if (domain && dismissed.domains.has(domain)) return { hold: true, why: "dismissed-domain", signals }
  if (signals.length >= HOLD_AT_SIGNALS) return { hold: true, why: "solicitation", signals }
  return { hold: false, signals }
}

/** The founder-facing line for a held arrival or an unsure draft: what the rules saw, in words. */
export function precheckSummary(p: Precheck): string {
  const labels = p.signals.map((c) => SOLICITATION_SIGNALS.find((s) => s.code === c)?.label ?? c)
  if (p.hold && p.why === "dismissed-sender") return "You dismissed this sender before as spam or a solicitation."
  if (p.hold && p.why === "dismissed-domain") return "You dismissed someone from this company's domain before as spam or a solicitation."
  if (p.hold) return `Looks like a solicitation: it ${labels.join(" and ")}.`
  return labels.length ? `One seller signal, so it was drafted anyway: it ${labels.join(" and ")}.` : ""
}
