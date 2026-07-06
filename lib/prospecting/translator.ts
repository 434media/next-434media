import { promises as fs } from "fs"
import path from "path"
import { tool } from "ai"
import { z } from "zod"
import { generateGatewayToolCall, GATEWAY_TEXT_MODELS } from "@/lib/ai-gateway-text"
import type {
  ApolloEmailStatus,
  ApolloSearchFilters,
  ApolloSeniority,
} from "./apollo"
import {
  ICP_INDUSTRIES,
  resolveIndustries,
  type IcpIndustry,
} from "./industry-tags"

/**
 * Stage 2 — LLM prompt translator.
 *
 * Takes a rep's free-form prospecting query (e.g. "CBG companies in Texas
 * making over $20M") and emits structured ApolloSearchFilters via Anthropic
 * tool-use. Reads lib/prospecting/icp.md as system context so the LLM knows
 * 434media's ICP — geography priorities, target industries, decision-maker
 * tiers, owned-audience differentiator.
 *
 * The translator deliberately uses Sonnet (not Opus) — this is a structured
 * extraction task, not creative copy. Sonnet handles tool-use just as well
 * and is meaningfully cheaper at the call volume we expect during dev +
 * production rep usage.
 *
 * No Apollo credits consumed here — this stage is pure LLM. Apollo only
 * gets called downstream once the rep approves a query.
 */

const ICP_PATH = path.join(process.cwd(), "lib/prospecting/icp.md")

let _icpContextCache: string | null = null

/**
 * Read icp.md once per process lifetime. The doc is part of the build, so
 * it's stable for the lifetime of any given deploy. To pick up edits in
 * dev, restart the server (or pull the cache into a state-aware mechanism
 * later if rep-edit-without-deploy becomes a need).
 */
async function getIcpContext(): Promise<string> {
  if (_icpContextCache) return _icpContextCache
  const content = await fs.readFile(ICP_PATH, "utf-8")
  _icpContextCache = content
  return content
}

// ─── Tool schema (input shape the LLM emits) ────────────────────────────

const SENIORITY_VALUES: ApolloSeniority[] = [
  "owner",
  "founder",
  "c_suite",
  "partner",
  "vp",
  "head",
  "director",
  "manager",
  "senior",
  "entry",
  "intern",
]

const EMAIL_STATUS_VALUES: ApolloEmailStatus[] = [
  "verified",
  "likely to engage",
  "unverified",
  "unavailable",
]

const FILTERS_TOOL_NAME = "submit_search_filters"

// Zod schema mirroring the previous Anthropic input_schema field-for-field —
// the descriptions ARE the behavioral contract that steers the model, so they
// are preserved verbatim. `reasoning` is the only required field (matches the
// prior `required: ["reasoning"]`); everything else is optional.
const filtersSchema = z.object({
  organization_locations: z
    .array(z.string())
    .optional()
    .describe(
      "Geographic locations of the company HQ. Use 'Texas, US' style strings. Default to Texas / Mexico / US Hispanic markets unless the user specifies otherwise.",
    ),
  person_titles: z
    .array(z.string())
    .optional()
    .describe(
      "Specific job titles to match (e.g. 'CEO', 'VP Marketing', 'Head of Partnerships'). Use this for named roles. For broader categories use person_seniorities instead.",
    ),
  include_similar_titles: z
    .boolean()
    .optional()
    .describe(
      "If true, expand exact-title matches with similar titles. Default true unless the user explicitly wants exact matches only.",
    ),
  person_seniorities: z
    .array(z.enum(SENIORITY_VALUES as [ApolloSeniority, ...ApolloSeniority[]]))
    .optional()
    .describe(
      "Seniority tiers for broad decision-maker queries. E.g. 'decision-makers' → ['c_suite','founder','vp','director']. Don't combine with person_titles unless the user wants a union.",
    ),
  num_employees_ranges: z
    .array(z.string())
    .optional()
    .describe(
      "Employee count ranges as 'min,max' strings. E.g. ['10,50','51,200']. Map size adjectives: 'small' → ['10,50'], 'mid' → ['51,500'], 'large' → ['501,5000']. Don't filter at all if the user didn't specify size.",
    ),
  revenue_range_min: z
    .number()
    .int()
    .optional()
    .describe(
      "Minimum annual revenue in USD integers. '$20M' → 20000000. '$1B' → 1000000000. Set only if the user specified a revenue floor.",
    ),
  revenue_range_max: z
    .number()
    .int()
    .optional()
    .describe(
      "Maximum annual revenue in USD integers. Set only if the user specified a revenue ceiling.",
    ),
  icp_industries: z
    .array(z.enum(ICP_INDUSTRIES as unknown as [IcpIndustry, ...IcpIndustry[]]))
    .optional()
    .describe(
      "The 434media ICP industry categories the target belongs to. This is the PRIMARY industry lever — emit it (not q_keywords) whenever the prompt or the matched archetype implies an industry. Pick from: healthcare_life_sciences, sports_fitness_lifestyle, tech_saas, capital_vc, media_broadcast, education_workforce, nonprofit_mission, cpg_consumer, civic_econ_dev. Choose all that clearly apply; leave empty if the prompt is industry-agnostic.",
    ),
  q_keywords: z
    .string()
    .optional()
    .describe(
      "Loose keyword search across the candidate profile — RESERVED for niche, non-industry terms an ICP industry category can't express (e.g. 'fight gear', 'cannabis', 'prosthetics', 'cumbia'). Do NOT put a broad industry here — use icp_industries for that. Keep it tight (one or two terms). Often left empty.",
    ),
  contact_email_status: z
    .array(
      z.enum(
        EMAIL_STATUS_VALUES as [ApolloEmailStatus, ...ApolloEmailStatus[]],
      ),
    )
    .optional()
    .describe(
      "Email-deliverability tiers to include. 434media uses Apollo primarily for OUTBOUND, so default to ['verified','likely to engage'] to keep results contactable. Widen to include 'unverified' ONLY if the rep explicitly asks for maximum reach / a wider net. Never include 'unavailable'. (This narrows WHO appears by email quality — it does not itself reveal the email address.)",
    ),
  hiring_job_titles: z
    .array(z.string())
    .optional()
    .describe(
      "Roles the target company is ACTIVELY HIRING for — a buying-moment / expansion signal (Apollo can't filter buying intent via API, so hiring is the proxy). Use the archetype's Tier-1/Tier-2 role language (e.g. 'Head of Partnerships', 'Brand Manager', 'Director of Events'). Set ONLY when the rep asks for hiring / expansion / 'just hired' / 'scaling' / 'growing' signals. Leave empty for ordinary firmographic searches.",
    ),
  min_active_job_postings: z
    .number()
    .int()
    .optional()
    .describe(
      "Minimum number of OPEN roles at the company — a generic growth/scaling proxy. Use for 'companies actively hiring' / 'growing teams' when the rep does NOT name a specific role (e.g. 1 = has any open posting). Don't combine with hiring_job_titles.",
    ),
  hiring_posted_within_days: z
    .number()
    .int()
    .optional()
    .describe(
      "Recency window in days for the hiring signal — 'in the last 90 days' → 90, 'recently' → 90. Set alongside hiring_job_titles or min_active_job_postings when the rep wants RECENT hiring. Typical values 30 / 60 / 90.",
    ),
  reasoning: z
    .string()
    .describe(
      "Brief 1–2 sentence explanation of how you mapped the user's prompt to filters. Mention any ICP defaults you applied (e.g. 'defaulted to Texas geography per ICP').",
    ),
  ambiguity_note: z
    .string()
    .optional()
    .describe(
      "ONLY include if the prompt is genuinely ambiguous (e.g. 'CBG' could be Cannabis or Consumer Brand Goods). Describe the ambiguity and what the user should clarify. Do NOT fabricate ambiguity to avoid making decisions.",
    ),
})

const filtersTool = tool({
  description:
    "Submit Apollo search filters derived from the user's prospecting query. Always call this tool — never respond in text. Map the user's intent onto the filter fields below using 434 Media's ICP as guidance. Set ambiguity_note ONLY when the query is genuinely ambiguous (e.g. an acronym with multiple plausible interpretations).",
  inputSchema: filtersSchema,
  // No execute — we only want the validated tool input, not a tool result.
})

// ─── Public API ─────────────────────────────────────────────────────────

export interface TranslateResult {
  /** Filters ready to pass to searchByFilters() */
  filters: ApolloSearchFilters
  /** Brief explanation of how the prompt was mapped */
  reasoning: string
  /** Set when the prompt was ambiguous; UI should surface a clarification step */
  ambiguityNote?: string
}

/**
 * Shape the LLM emits via the tool — looser than ApolloSearchFilters so
 * we can validate before mapping.
 */
interface RawTranslatedFilters {
  organization_locations?: string[]
  person_titles?: string[]
  include_similar_titles?: boolean
  person_seniorities?: string[]
  num_employees_ranges?: string[]
  revenue_range_min?: number
  revenue_range_max?: number
  icp_industries?: string[]
  q_keywords?: string
  contact_email_status?: string[]
  hiring_job_titles?: string[]
  min_active_job_postings?: number
  hiring_posted_within_days?: number
  reasoning?: string
  ambiguity_note?: string
}

function buildSystemPrompt(icp: string): string {
  return `You are a B2B lead-prospecting assistant for 434 Media, a media + storytelling company headquartered in San Antonio, Texas. Your single job is to translate a sales rep's free-form prospecting query into structured Apollo search filters.

You MUST call the submit_search_filters tool exactly once. Never respond in text.

────────────────────────────────────────────────────────────────────
434 MEDIA ICP CONTEXT (use this to inform your filter choices)
────────────────────────────────────────────────────────────────────

${icp}

────────────────────────────────────────────────────────────────────
TRANSLATION RULES
────────────────────────────────────────────────────────────────────

1. Don't drop signal — every concrete constraint in the user's prompt should appear as a filter.
2. Apply ICP defaults when the user is silent about a dimension. If they don't mention geography, default to Texas (the ICP's primary market). If they don't mention seniority, default to decision-maker tiers (c_suite, founder, vp, director, head).
3. Use person_titles for specific named roles. Use person_seniorities for broad categories.
4. Convert revenue language to USD integers: "$20M" → 20000000.
5. Convert size language to ranges: "small" → ["10,50"], "mid" → ["51,500"], "small to mid" → ["10,50","51,500"].
6. Set ambiguity_note ONLY when the query is genuinely ambiguous — acronyms with multiple plausible meanings (CBG, CPG vs. CBG), vague terms that could go several ways. Don't invent ambiguity.
7. Reasoning must be brief (1–2 sentences) and explain ICP defaults you applied.
8. Don't translate negative filters (the ICP "exclude agencies/PR firms" rule) — that's the scorer's job, not the search filter's.
9. NEVER include EU member states, the UK, EEA countries, Switzerland, or Canada in organization_locations. 434media does not pursue cold outbound there (GDPR / CASL). If the user explicitly asks for these regions, set ambiguity_note explaining the constraint and DO NOT include those locations in the filter — let them clarify or pivot. The scorer hard-excludes any EU/CA results that slip through, but the translator should prevent us from burning Apollo credits on them in the first place.

10. PERSONA TIERS. Each ICP archetype above defines Tier 1 (Economic Buyer), Tier 2 (Champion), Tier 3 (End User). For OUTBOUND, the Champion (Tier 2) is usually the best first-touch, so it should be included — not just the C-suite. When the rep names an archetype ("sponsor-buyers", "event partners") or asks broadly for "decision-makers", pull person_titles / person_seniorities from BOTH that archetype's Tier 1 and Tier 2 rows. When the rep names a specific title, respect it exactly and don't widen.

11. INDUSTRY. Emit icp_industries (the ICP industry-category enum) whenever the prompt or the matched archetype implies an industry — this is the primary industry lever. Reserve q_keywords for niche non-industry terms only (e.g. 'fight gear', 'prosthetics'). Don't duplicate a broad industry across both fields.

12. EMAIL STATUS. 434media uses Apollo primarily for outbound, so default contact_email_status to ['verified','likely to engage'] to keep results contactable. Only widen to include 'unverified' if the rep explicitly asks for maximum reach. Mention this default in reasoning.

13. HIRING SIGNAL (the WHEN axis). Apollo's API can't filter by buying intent, but it CAN filter on hiring activity — the best available buying-moment proxy. When the rep asks for timing / expansion / growth / "just hired" / "scaling" / "actively hiring" signals: set hiring_job_titles for specific roles being hired (use the archetype's Tier-1/Tier-2 title language), OR min_active_job_postings for a generic "is hiring" (e.g. 1), plus hiring_posted_within_days for recency (default 90 when recency is implied). Leave ALL hiring fields empty for ordinary firmographic searches — never impose a hiring constraint the rep didn't ask for.`
}

/**
 * Translate a free-form rep prompt into ApolloSearchFilters using Claude
 * via tool-use. The LLM is forced to call the submit_search_filters tool
 * (no free-form text response), so the output shape is predictable.
 *
 * Throws if the model fails to call the tool (rare with tool_choice). The
 * caller should treat any throw as a translator failure and surface it to
 * the rep as "couldn't parse query — try rephrasing."
 */
export async function translatePromptToFilters(
  userPrompt: string,
): Promise<TranslateResult> {
  const trimmed = userPrompt.trim()
  if (!trimmed) {
    throw new Error("Translator: prompt is empty")
  }

  const icp = await getIcpContext()

  // Forced single-tool extraction through the AI Gateway — equivalent to the
  // prior Anthropic `tool_choice: { type: "tool" }`. Returns the validated
  // tool input (schema-checked against filtersSchema).
  const raw = await generateGatewayToolCall<RawTranslatedFilters>({
    model: GATEWAY_TEXT_MODELS.translator,
    maxTokens: 1024,
    system: buildSystemPrompt(icp),
    prompt: trimmed,
    toolName: FILTERS_TOOL_NAME,
    tool: filtersTool,
  })

  // Map LLM output to the strict ApolloSearchFilters shape. The LLM emits
  // a flat shape; we lift revenue_range into a nested object and drop empty
  // arrays/strings so downstream callers don't have to defensive-check.
  const filters: ApolloSearchFilters = {}

  if (raw.organization_locations?.length) {
    filters.organization_locations = raw.organization_locations
  }
  if (raw.person_titles?.length) {
    filters.person_titles = raw.person_titles
  }
  if (raw.include_similar_titles !== undefined) {
    filters.include_similar_titles = raw.include_similar_titles
  }
  if (raw.person_seniorities?.length) {
    // Filter to known enum values — the LLM should respect the schema, but
    // defensive-clean against any drift.
    const valid = raw.person_seniorities.filter(
      (s): s is ApolloSeniority => SENIORITY_VALUES.includes(s as ApolloSeniority),
    )
    if (valid.length) filters.person_seniorities = valid
  }
  if (raw.num_employees_ranges?.length) {
    filters.num_employees_ranges = raw.num_employees_ranges
  }
  if (raw.revenue_range_min !== undefined || raw.revenue_range_max !== undefined) {
    filters.revenue_range = {}
    if (raw.revenue_range_min !== undefined) {
      filters.revenue_range.min = raw.revenue_range_min
    }
    if (raw.revenue_range_max !== undefined) {
      filters.revenue_range.max = raw.revenue_range_max
    }
  }
  // Industry — resolve the ICP industry categories to Apollo's precise
  // server-side tag-ID filter. While tag IDs aren't configured yet, this
  // returns fallback keywords instead, preserving keyword-based industry
  // filtering. A niche q_keywords term (if the LLM set one) takes precedence
  // over the generic industry fallback to avoid over-narrowing.
  const industries = (raw.icp_industries ?? []).filter(
    (i): i is IcpIndustry => ICP_INDUSTRIES.includes(i as IcpIndustry),
  )
  const resolved = resolveIndustries(industries)
  if (resolved.tagIds.length) {
    filters.industry_tag_ids = resolved.tagIds
  }
  const nicheKeyword = raw.q_keywords?.trim()
  const keyword = nicheKeyword || resolved.keywords.join(" ")
  if (keyword) {
    filters.q_keywords = keyword
  }
  if (raw.contact_email_status?.length) {
    // Defensive-clean against enum drift, same posture as person_seniorities.
    const valid = raw.contact_email_status.filter(
      (s): s is ApolloEmailStatus =>
        EMAIL_STATUS_VALUES.includes(s as ApolloEmailStatus),
    )
    if (valid.length) filters.contact_email_status = valid
  }

  // Hiring signal (WHEN axis) — Apollo's API can't filter buying intent, so
  // active hiring is the best available buying-moment proxy.
  if (raw.hiring_job_titles?.length) {
    filters.organization_job_titles = raw.hiring_job_titles
  }
  if (raw.min_active_job_postings !== undefined && raw.min_active_job_postings > 0) {
    filters.num_jobs_range = { min: raw.min_active_job_postings }
  }
  if (
    raw.hiring_posted_within_days !== undefined &&
    raw.hiring_posted_within_days > 0
  ) {
    // Convert the LLM's relative window to an absolute "posted since" date using
    // the server clock (the LLM shouldn't do date math). ISO yyyy-mm-dd.
    const since = new Date(Date.now() - raw.hiring_posted_within_days * 86_400_000)
    filters.job_posted_at_range = { min: since.toISOString().slice(0, 10) }
  }

  return {
    filters,
    reasoning: raw.reasoning?.trim() || "(no reasoning provided)",
    ambiguityNote: raw.ambiguity_note?.trim() || undefined,
  }
}
