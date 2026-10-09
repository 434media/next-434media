/**
 * ICP industry → Apollo industry-tag-ID mapping.
 *
 * Apollo's People Search filters industry via `organization_industry_tag_ids`,
 * which takes Apollo's opaque internal ObjectIds (e.g. "5567cd4773696439b10b0000"),
 * NOT free text. The translator can't invent those, so this module maps
 * 434media's controlled ICP industry vocabulary (mirrors the "Industries
 * (positive signals)" section of icp-base.md) onto Apollo's tag IDs.
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

// Controlled vocabulary — keep in sync with icp-base.md "Industries (positive signals)".
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
  // Added 2026-10-09 for the outbound cohorts' structured match fields
  // (next-434media#63): cohort A needed a defense category, cohort E an agency
  // category. The cohort schema in 434-context ("05 System of Record/schemas/
  // cohort.schema.json", match.industries) holds a copy of this list: change
  // both together.
  "defense_aerospace",
  "marketing_agency",
  // Added the same day for cohort A's prose: advanced manufacturers, and
  // military-health and veteran-employment / defense-workforce organizations.
  "advanced_manufacturing",
  "military_veteran",
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
  // defense & space · aviation & aerospace · military (tag IDs not yet captured)
  defense_aerospace: {
    label: "Defense & aerospace",
    tagIds: [],
    keyword: "defense",
  },
  // marketing & advertising · public relations & communications (tag IDs not yet captured)
  marketing_agency: {
    label: "Marketing, advertising & PR agencies",
    tagIds: [],
    keyword: "advertising agency",
  },
  // machinery · industrial automation · electrical/electronic manufacturing ·
  // semiconductors · mechanical or industrial engineering (tag IDs not yet captured)
  advanced_manufacturing: {
    label: "Advanced manufacturing",
    tagIds: [],
    keyword: "manufacturing",
  },
  // military · veterans' health and services · defense workforce (tag IDs not yet captured)
  military_veteran: {
    label: "Military health & veteran services",
    tagIds: [],
    keyword: "veteran",
  },
}

/**
 * Which ICP industries a company's own industry text and name point to — the
 * reverse of INDUSTRY_MAP, for scoring a lead or a candidate against the
 * cohorts' structured match fields (lib/prospecting/cohort-match.ts).
 *
 * Terms are Apollo industry names (as listed per category above) and the plain
 * words people type into a lead's industry field. A term matches as a whole
 * word or phrase at a word start, so "health" matches "healthcare" and
 * "Health Science" but "ai" never matches inside "maintenance".
 */
export const INDUSTRY_TERMS: Record<IcpIndustry, string[]> = {
  healthcare_life_sciences: [
    "health", "hospital", "medical", "medicine", "pharma", "biotech", "life science",
    "clinic", "nursing", "dental", "medical device",
  ],
  sports_fitness_lifestyle: ["sport", "fitness", "boxing", "athletic", "martial art", "wellness", "fight"],
  tech_saas: [
    "software", "information technology", "saas", "internet", "computer", "it services",
    "it system", "cyber", "artificial intelligence", "tech",
  ],
  capital_vc: [
    "venture capital", "private equity", "investment", "financial services", "accelerator",
    "incubator", "angel investor",
  ],
  media_broadcast: ["media", "broadcast", "television", "radio", "publishing", "entertainment", "film", "newspaper"],
  education_workforce: ["education", "university", "college", "school", "e-learning", "training", "workforce", "academy"],
  nonprofit_mission: [
    "nonprofit", "non-profit", "philanthropy", "foundation", "civic & social", "religious",
    "ministries", "charity", "charitable",
  ],
  cpg_consumer: ["consumer goods", "food", "beverage", "retail", "apparel", "cosmetics", "restaurant"],
  civic_econ_dev: ["government", "public policy", "economic development", "think tank", "chamber of commerce", "municipal"],
  defense_aerospace: ["defense", "defence", "aerospace", "aviation", "military"],
  marketing_agency: [
    "marketing & advertising", "advertising", "public relations", "marketing agency",
    "creative agency", "pr firm", "agency",
  ],
  advanced_manufacturing: [
    "manufactur", "machinery", "industrial automation", "semiconductor", "electronic manufacturing",
    "mechanical or industrial engineering", "industrial engineering",
  ],
  military_veteran: [
    "military health", "military medic", "defense health", "veterans affairs", "veteran", "army",
    "navy", "air force", "marine corps", "military",
  ],
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const TERM_PATTERNS: [IcpIndustry, RegExp][] = ICP_INDUSTRIES.flatMap((ind) =>
  INDUSTRY_TERMS[ind].map((t): [IcpIndustry, RegExp] => [ind, new RegExp(`(^|[^a-z])${escapeRe(t)}`, "i")]),
)

/** The ICP industries a company's industry text and name point to. */
export function classifyIndustries(industry?: string | null, company?: string | null): IcpIndustry[] {
  const text = `${industry ?? ""} | ${company ?? ""}`.toLowerCase()
  if (!text.replace(/[|\s]/g, "")) return []
  const found = new Set<IcpIndustry>()
  for (const [ind, re] of TERM_PATTERNS) if (re.test(text)) found.add(ind)
  return ICP_INDUSTRIES.filter((i) => found.has(i))
}

export interface ResolvedIndustry {
  /** Apollo industry tag IDs to filter on (precise, server-side). */
  tagIds: string[]
  /**
   * One fallback industry keyword for q_keywords, used only when no selected
   * industry has tag IDs. Never several joined: Apollo matches every word of
   * q_keywords, so "defense manufacturing veteran" returns nothing.
   */
  keyword: string | null
}

/**
 * Resolve selected ICP industries to Apollo filters.
 *
 * Prefers precise server-side tag IDs. Falls back to fuzzy keywords ONLY when
 * NONE of the selected industries have tag IDs configured — mixing a precise
 * tag-ID filter with a fuzzy AND keyword would wrongly narrow the tag-matched
 * results.
 *
 * The fallback is ONE keyword: the first selected industry's, which is the
 * model's primary choice. Apollo's q_keywords is a single string that must
 * match in full, so joining keywords narrows to their intersection (cohort A's
 * three industries joined to "defense manufacturing veteran" and returned
 * nothing, preview 2026-10-09). Sending each separately would take one search
 * per industry. Once an industry's tag IDs are captured it never falls back.
 */
export function resolveIndustries(industries: IcpIndustry[]): ResolvedIndustry {
  const tagIds = new Set<string>()
  let fallbackKeyword: string | null = null

  for (const key of industries) {
    const m = INDUSTRY_MAP[key]
    if (!m) continue
    m.tagIds.forEach((id) => tagIds.add(id))
    if (!m.tagIds.length && fallbackKeyword === null) fallbackKeyword = m.keyword
  }

  if (tagIds.size > 0) return { tagIds: [...tagIds], keyword: null }
  return { tagIds: [], keyword: fallbackKeyword }
}
