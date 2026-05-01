import type { Lead } from "@/types/crm-types"

/**
 * 434media brand context — fed into every Claude prompt so drafts ladder up
 * to the actual sub-brands and value props rather than generic agency talk.
 *
 * Edit when the audience/portfolio shifts. This is the single source of truth
 * for what Claude knows about who we are.
 */
const BRAND_CONTEXT = `434 Media is a San Antonio-based media company that owns niche, engaged audiences across several sub-brands:

- TXMX Boxing — boxing, combat sports, Latino fight culture
- VemosVamos — bicultural lifestyle, Texas/LATAM crossover
- MilCityUSA — military, federal innovation, veteran community
- DevSA — San Antonio tech, developers, startups
- Digital Canvas — content distribution, editorial layer

What we offer prospects:
- Direct access to engaged, brand-loyal audiences (not rented impressions)
- First-party data on those audiences
- Cultural relevance in Texas and LATAM markets
- Event integration and IP partnerships, not just media buys

What we are NOT: a generic marketing agency, an ad network, or a content shop.`.trim()

/**
 * Words/phrases that flag corporate-speak. We tell Claude to avoid them
 * explicitly because it will reach for them by default.
 */
const BANNED_PHRASES = [
  "elevate your brand",
  "cutting-edge",
  "synergy",
  "best-in-class",
  "next-level",
  "leverage",
  "unlock",
  "ecosystem of solutions",
  "thought leadership",
]

interface BuildPromptOptions {
  lead: Lead
  /** Optional rep name — appears in the closing CTA so the email doesn't look unsigned. */
  repName?: string
}

export interface BuildPromptResult {
  /** Sent as user message body. */
  prompt: string
  /** Sent as the system prompt. */
  system: string
}

export function buildLeadOutreachPrompt({ lead, repName }: BuildPromptOptions): BuildPromptResult {
  const scoreSignals = Object.entries(lead.score_breakdown ?? {})
    .filter(([, v]) => typeof v === "number" && v > 0)
    .map(([k, v]) => `${k} (+${v})`)
    .join(", ")

  const tagsLine = lead.tags && lead.tags.length > 0 ? lead.tags.join(", ") : "(none)"
  const repLine = repName ? `Sender: ${repName} at 434 Media` : ""

  const system = `You are a senior business development writer for 434 Media. You write outbound prospecting emails that read like a real person reached out, not a marketing template. You know the 434 portfolio cold and you tailor every send to which sub-brand actually fits the prospect's world.

${BRAND_CONTEXT}

Tone: direct, specific, conversational. American business email register — not casual, not stiff.
Length: 4–6 sentences. No preamble, no signature, no subject line. Output only the email body.
Banned phrases (do not use): ${BANNED_PHRASES.join("; ")}.`

  const prompt = `Write an outbound email to this prospect:

Name: ${lead.name || "(unknown)"}
Title: ${lead.title || "(unknown)"}
Company: ${lead.company || "(unknown)"}
Industry: ${lead.industry || "(unknown)"}
Location: ${lead.location || "(unknown)"}
Capture source: ${lead.source}
Suggested platform fit: ${lead.platform || "(none yet — pick the best from the portfolio)"}
Tags: ${tagsLine}
Lead-scoring signals that fired: ${scoreSignals || "(none — be cautious about assuming fit)"}
${repLine}

Rules for this draft:
- Lead with the audience or sub-brand most relevant to their industry. If multiple fit, pick the strongest one and commit to it.
- Be specific to their world — reference their industry or location, not generic phrases.
- Make one concrete value claim. Don't list capabilities.
- End with a low-friction CTA: a 15-minute call, or just a one-line reply.
- Output the email body only. No subject line. No preamble. No signature.`

  return { prompt, system }
}
