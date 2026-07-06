/**
 * ICP industry → Apollo industry-tag-ID mapping.
 *
 * Apollo's People Search filters industry via `organization_industry_tag_ids`,
 * which takes Apollo's opaque internal ObjectIds (e.g. "5567cd4773696439b10b0000"),
 * NOT free text. The translator can't invent those, so this module maps
 * 434media's controlled ICP industry vocabulary (mirrors the "Industries
 * (positive signals)" section of icp.md) onto Apollo's tag IDs.
 *
 * ── How to populate `tagIds` ────────────────────────────────────────────
 * The IDs are stable per Apollo account. To grab them:
 *   1. In Apollo → People Search → open the "Industry & Keywords" filter and
 *      pick an industry. The active filter's tag ID appears in the search URL
 *      (…organizationIndustryTagIds[]=<id>…), or
 *   2. Call Apollo's industry-tags reference (GET /industry_tags on Basic+) and
 *      match by name.
 * Paste one or more IDs per category below. A category can map to SEVERAL
 * Apollo industries (e.g. "Capital" → venture capital + financial services).
 *
 * ── Behavior while `tagIds` is empty ────────────────────────────────────
 * SAFE: an empty `tagIds` array falls back to the `keyword` term (pushed into
 * q_keywords by the translator), preserving today's keyword-based industry
 * filtering. The precise server-side tag filter switches on automatically the
 * moment any tag IDs are filled in — no code change needed.
 */

// Controlled vocabulary — keep in sync with icp.md "Industries (positive signals)".
export const ICP_INDUSTRIES = [
  "healthcare_life_sciences",
  "sports_fitness_lifestyle",
  "tech_saas",
  "capital_vc",
  "media_broadcast",
  "education_workforce",
  "nonprofit_mission",
  "cpg_consumer",
  "civic_econ_dev",
] as const

export type IcpIndustry = (typeof ICP_INDUSTRIES)[number]

interface IndustryMapping {
  /** Human label — used in reasoning / future filter chips. */
  label: string
  /**
   * Apollo `organization_industry_tag_ids`. Empty until populated (see header).
   * May hold multiple IDs when one ICP category spans several Apollo industries.
   * Apollo industry names to look up per category are listed in the comments.
   */
  tagIds: string[]
  /** Fallback keyword used (via q_keywords) while `tagIds` is empty. */
  keyword: string
}

export const INDUSTRY_MAP: Record<IcpIndustry, IndustryMapping> = {
  // hospital & health care · pharmaceuticals · mental health care
  // (add later if captured: biotechnology, medical devices)
  healthcare_life_sciences: {
    label: "Healthcare & life sciences",
    tagIds: ["5567cdde73696439812c0000", "5567e0eb73696410e4bd1200", "5567ce2773696454308f0000"],
    keyword: "healthcare",
  },
  // sports · apparel & fashion (add later: health/wellness/fitness, sporting goods)
  sports_fitness_lifestyle: {
    label: "Sports, fitness & lifestyle",
    tagIds: ["5567ce227369644eed290000", "5567cd82736964540d0b0000"],
    keyword: "sports",
  },
  // computer software · information technology & services · internet
  tech_saas: {
    label: "Tech & SaaS",
    tagIds: ["5567cd4e7369643b70010000", "5567cd4773696439b10b0000", "5567cd4d736964397e020000"],
    keyword: "software",
  },
  // venture capital & private equity · financial services · investment management
  capital_vc: {
    label: "Capital / VC / accelerators",
    tagIds: ["5567e1587369641c48370000", "5567cdd67369643e64020000", "5567e0bc7369641d11550200"],
    keyword: "venture capital",
  },
  // broadcast media · media production · online media (add later: entertainment)
  media_broadcast: {
    label: "Media & broadcast",
    tagIds: ["5567e0f973696416d34e0200", "5567e0ea7369640d2ba31600", "5567cdb373696439dd540000"],
    keyword: "media",
  },
  // higher education · education management · e-learning · professional training & coaching
  education_workforce: {
    label: "Education & workforce",
    tagIds: [
      "5567cd4c73696453e1300000",
      "5567ce9e736964540d540000",
      "5567e19c7369641c48e70100",
      "5567cd49736964541d010000",
    ],
    keyword: "education",
  },
  // nonprofit organization management · civic & social organization · philanthropy · religious institutions
  nonprofit_mission: {
    label: "Nonprofit & mission-driven",
    tagIds: [
      "5567cd4773696454303a0000",
      "5567cdda7369644eed130000",
      "5567ce9673696453d99f0000",
      "5567e0f27369640e5aed0c00",
    ],
    keyword: "nonprofit",
  },
  // consumer goods · food & beverages · retail · apparel & fashion
  cpg_consumer: {
    label: "CPG / consumer brands",
    tagIds: [
      "5567ce987369643b789e0000",
      "5567ce1e7369643b806a0000",
      "5567ced173696450cb580000",
      "5567cd82736964540d0b0000",
    ],
    keyword: "consumer goods",
  },
  // government administration · public policy · think tanks
  civic_econ_dev: {
    label: "Civic-tech & economic development",
    tagIds: ["5567cd527369643981050000", "5567e28a7369642ae2500000", "5567e1de7369642069ea0100"],
    keyword: "economic development",
  },
}

export interface ResolvedIndustry {
  /** Apollo industry tag IDs to filter on (precise, server-side). */
  tagIds: string[]
  /** Fallback industry keywords for q_keywords (used only when no tag IDs). */
  keywords: string[]
}

/**
 * Resolve selected ICP industries to Apollo filters.
 *
 * Prefers precise server-side tag IDs. Falls back to fuzzy keywords ONLY when
 * NONE of the selected industries have tag IDs configured — mixing a precise
 * tag-ID filter with a fuzzy AND keyword would wrongly narrow the tag-matched
 * results. Returns deduped arrays.
 */
export function resolveIndustries(industries: IcpIndustry[]): ResolvedIndustry {
  const tagIds = new Set<string>()
  const fallbackKeywords = new Set<string>()

  for (const key of industries) {
    const m = INDUSTRY_MAP[key]
    if (!m) continue
    m.tagIds.forEach((id) => tagIds.add(id))
    if (!m.tagIds.length) fallbackKeywords.add(m.keyword)
  }

  if (tagIds.size > 0) return { tagIds: [...tagIds], keywords: [] }
  return { tagIds: [], keywords: [...fallbackKeywords] }
}
