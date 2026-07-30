import type { Lead } from "@/types/crm-types"

/**
 * 434media brand context — fed into every Claude prompt so drafts ladder up
 * to the actual sub-brands and value props rather than generic agency talk.
 *
 * Edit when the audience/portfolio shifts. This is the single source of truth
 * for what Claude knows about who we are.
 */
export const BRAND_CONTEXT = `434 Media is a San Antonio-based media company that owns niche, engaged audiences across several sub-brands:

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
 * Voice exemplars.
 *
 * These replaced a list of banned phrases ("elevate your brand", "synergy",
 * "leverage", …). A prohibition list only rules out the exact strings on it and
 * says nothing about what good looks like — newer models follow it literally
 * and route around it into different corporate-speak. Showing the target voice
 * generalizes instead, and it stays useful as models change.
 *
 * Both examples are cold first-touches. Note what they do: name one sub-brand
 * and commit to it, reference the prospect's actual world, make exactly one
 * concrete claim, admit uncertainty rather than overclaiming fit, and close
 * with something cheap to say yes to.
 *
 * Edit these when the voice drifts — they steer output more than any rule.
 */
const VOICE_EXEMPLARS = `<example industry="regional healthcare system">
Jesse here at 434 Media, based in San Antonio. We run VemosVamos, a bicultural
lifestyle brand whose audience is mostly Spanish-dominant and bilingual
households across the South and West sides — the households that tend to tune
out a translated version of an English campaign. Ours opt in for content built
for them in the first place, which is why our health placements move appointment
intent instead of impressions nobody can trace. I don't know enough about how
you're approaching patient acquisition right now to tell you this is a fit, but
if bicultural reach is on the list this year it's worth a conversation. Worth 15
minutes, or just reply and tell me it's not where your priorities sit.
</example>

<example industry="regional bank sponsoring youth sports">
Jesse at 434 Media. You're already putting money into youth sports around San
Antonio, so you know the hard part isn't the sponsorship — it's having anything
to show for it after the banner comes down. TXMX Boxing covers the fight scene
here year-round, and the audience treats it as their sport rather than a
marketing channel, so a partner shows up in the coverage instead of beside it.
We'd own the content, not just the signage. Open to a 15-minute call to see
whether the calendar lines up with yours?
</example>`

/**
 * Which email in the 3-step sequence to draft. Undefined = a standalone
 * one-off draft (the original single-send behavior).
 *  1 — intro: name a relevant challenge, invite to discuss
 *  2 — value: reinforce the value prop with specifics, encourage a reply
 *  3 — final follow-up: polite, acknowledge other priorities, leave the door open
 */
export type SequenceStep = 1 | 2 | 3

interface BuildPromptOptions {
  lead: Lead
  /** Optional rep name — appears in the closing CTA so the email doesn't look unsigned. */
  repName?: string
  /** When set, draft this step of the 3-email sequence instead of a one-off. */
  step?: SequenceStep
}

// Step-specific guidance appended to the draft rules. Later steps are explicitly
// framed as follow-ups so they don't re-introduce 434 from scratch.
const STEP_GUIDANCE: Record<SequenceStep, string> = {
  1: `This is EMAIL 1 of a 3-email sequence — the first touch.
- Introduce 434 Media briefly and name a relevant business challenge this prospect likely faces.
- Invite them to discuss. This is the opener; do not reference prior emails.`,
  2: `This is EMAIL 2 of a 3-email sequence — a follow-up to a first email they did NOT reply to.
- Open by lightly acknowledging you reached out before (don't re-introduce from scratch).
- Reinforce the value with ONE specific benefit or concrete result, and encourage a reply.`,
  3: `This is EMAIL 3 of a 3-email sequence — the final, polite follow-up.
- Acknowledge they're busy and have other priorities. Keep it short and gracious.
- Leave the door open for the future. No pressure, no guilt. This is the last touch.`,
}

export interface BuildPromptResult {
  /** Sent as user message body. */
  prompt: string
  /** Sent as the system prompt. */
  system: string
}

// The prospect fact-block that steers any draft — shared by the from-scratch
// writer and the template-fill personalizer so both see the same lead context.
function leadDataBlock(lead: Lead, repName?: string): string {
  const scoreSignals = Object.entries(lead.score_breakdown ?? {})
    .filter(([, v]) => typeof v === "number" && v > 0)
    .map(([k, v]) => `${k} (+${v})`)
    .join(", ")

  const tagsLine = lead.tags && lead.tags.length > 0 ? lead.tags.join(", ") : "(none)"
  const repLine = repName ? `Sender: ${repName} at 434 Media` : ""

  // Engagement signal — whether this contact has already shown interest via our
  // email (opens/clicks). A warm contact gets a different opener than a cold one.
  const opens = lead.email_opens ?? 0
  const clicks = lead.email_clicks ?? 0
  const engagementLine =
    opens > 0 || clicks > 0
      ? `Prior email engagement: ${opens} open(s), ${clicks} click(s)${
          lead.last_contacted_at ? ` (last contacted ${lead.last_contacted_at.split("T")[0]})` : ""
        } — this is a WARM contact who already engaged with us.`
      : "Prior email engagement: none yet — treat as a cold first-touch."

  // Provenance — how the lead entered our world. Gives a legitimate reason to reach out.
  const originLine = lead.origin_ref
    ? `How we got them: promoted from ${lead.origin_ref.collection.replace(/_/g, " ")} on ${lead.origin_ref.promoted_at?.split("T")[0] ?? "(unknown date)"}.`
    : ""

  return `Name: ${lead.name || "(unknown)"}
Title: ${lead.title || "(unknown)"}
Company: ${lead.company || "(unknown)"}
Industry: ${lead.industry || "(unknown)"}
Location: ${lead.location || "(unknown)"}
Capture source: ${lead.source}
Suggested platform fit: ${lead.platform || "(none yet — pick the best from the portfolio)"}
Tags: ${tagsLine}
Lead-scoring signals that fired: ${scoreSignals || "(none — be cautious about assuming fit)"}
${engagementLine}
${originLine}
${repLine}`.trim()
}

export function buildLeadOutreachPrompt({ lead, repName, step }: BuildPromptOptions): BuildPromptResult {
  const stepLine = step ? `\n${STEP_GUIDANCE[step]}\n` : ""

  const system = `You are a senior business development writer for 434 Media. You write outbound prospecting emails that read like a real person reached out, not a marketing template. You know the 434 portfolio cold and you tailor every send to which sub-brand actually fits the prospect's world.

${BRAND_CONTEXT}

Tone: direct, specific, conversational. American business email register — not casual, not stiff.
Length: 4–6 sentences. No preamble, no signature, no subject line. Output only the email body.

Here are two emails in the voice we want. Match their register and their level of
concreteness — don't reuse their wording or their sub-brand:

${VOICE_EXEMPLARS}`

  const prompt = `Write an outbound email to this prospect:

${leadDataBlock(lead, repName)}
${stepLine}
Rules for this draft:
- Lead with the audience or sub-brand most relevant to their industry. If multiple fit, pick the strongest one and commit to it.
- Be specific to their world — reference their industry or location, not generic phrases.
- If this is a WARM contact (prior engagement), acknowledge it naturally — don't open as if it's a first introduction. If cold, a clean first-touch opener.
- Make one concrete value claim. Don't list capabilities.
- End with a low-friction CTA: a 15-minute call, or just a one-line reply.
- Output the email body only. No subject line. No preamble. No signature.`

  return { prompt, system }
}

interface TemplateFillOptions {
  lead: Lead
  repName?: string
  step: SequenceStep
  /** The approved template's subject line (may contain [placeholders]). */
  subjectTemplate?: string
  /** The approved template's body copy (contains [placeholders] to fill). */
  bodyTemplate: string
}

/**
 * Hybrid path: personalize one of the GTM squad's APPROVED outreach templates
 * (from the SOPs) for a specific lead — the AI fills the [placeholders] with real
 * lead data while keeping the team's structure, sequence intent, and voice.
 * Output is "Subject: …\n\n<body>" so the caller can split subject from body.
 */
export function buildTemplateFillPrompt({
  lead,
  repName,
  step,
  subjectTemplate,
  bodyTemplate,
}: TemplateFillOptions): BuildPromptResult {
  const system = `You are a senior business development writer for 434 Media. You personalize the GTM team's APPROVED outbound email templates for one specific prospect. Keep the template's structure, sequence intent, length, and voice — replace every [bracketed placeholder] with a real, specific value.

${BRAND_CONTEXT}

Rules:
- Replace EVERY [placeholder] with a concrete value. Never leave a bracket, and never output a literal "[...]".
- Use ONLY real prospect data + the 434 portfolio above. Do NOT invent fake metrics, client names, or results. If a placeholder needs data you don't have, rewrite that sentence to make an honest, specific point without fabricating — or drop it.
- Keep the template's length, structure, and CTA. Match its tone. Lead with the 434 sub-brand most relevant to the prospect's industry.

The approved template's voice wins wherever the two differ, but these show the
house register to aim for when a placeholder leaves you room to choose:

${VOICE_EXEMPLARS}

Output the subject line first as "Subject: <text>", then a blank line, then the email body only. No commentary.`

  const prompt = `Personalize this approved email ${step} template for the prospect below.

PROSPECT:
${leadDataBlock(lead, repName)}

${STEP_GUIDANCE[step]}

APPROVED TEMPLATE — keep its shape, fill its placeholders:
Subject: ${subjectTemplate?.trim() || "(none provided — write a short, specific subject)"}

${bodyTemplate.trim()}`

  return { prompt, system }
}
