import type {
  ApolloEmailStatus,
  ApolloSearchFilters,
  ApolloSeniority,
} from "./apollo"
import { type IcpIndustry, resolveIndustries } from "./industry-tags"

/**
 * Step 17/18 — archetype presets + the editable-draft filter shape.
 *
 * `ProspectDraft` is the UI-facing filter shape the rep edits. It differs from
 * `ApolloSearchFilters` in two ways, both to keep the editor human-readable:
 *   - industry is expressed as `icp_industries` (readable categories), not the
 *     resolved `industry_tag_ids` / folded keyword;
 *   - `q_keywords` holds only the niche (non-industry) term.
 * `draftToFilters()` resolves it to the Apollo shape at search time.
 */
export interface ProspectDraft {
  organization_locations?: string[]
  person_titles?: string[]
  include_similar_titles?: boolean
  person_seniorities?: ApolloSeniority[]
  num_employees_ranges?: string[]
  revenue_range?: { min?: number; max?: number }
  icp_industries?: IcpIndustry[]
  organization_job_titles?: string[]
  num_jobs_range?: { min?: number; max?: number }
  job_posted_at_range?: { min?: string; max?: string }
  q_keywords?: string
  contact_email_status?: ApolloEmailStatus[]
}

/** Resolve an editable draft into the Apollo search shape (industries → tag IDs / keyword). */
export function draftToFilters(draft: ProspectDraft): ApolloSearchFilters {
  const { icp_industries, q_keywords, ...rest } = draft
  const filters: ApolloSearchFilters = { ...rest }

  const resolved = resolveIndustries(icp_industries ?? [])
  if (resolved.tagIds.length) filters.industry_tag_ids = resolved.tagIds

  // Niche keyword wins; else fall back to the industry keyword (interim, while
  // tag IDs are unpopulated). Mirrors the translator's own reconciliation.
  const niche = q_keywords?.trim()
  const keyword = niche || resolved.keywords.join(" ")
  if (keyword) filters.q_keywords = keyword

  return filters
}

/** Build an editable draft from a translate response (filters + separated industry/niche). */
export function filtersToDraft(
  filters: ApolloSearchFilters,
  icpIndustries: IcpIndustry[],
  nicheKeyword: string,
): ProspectDraft {
  return {
    organization_locations: filters.organization_locations,
    person_titles: filters.person_titles,
    include_similar_titles: filters.include_similar_titles,
    person_seniorities: filters.person_seniorities,
    num_employees_ranges: filters.num_employees_ranges,
    revenue_range: filters.revenue_range,
    organization_job_titles: filters.organization_job_titles,
    num_jobs_range: filters.num_jobs_range,
    job_posted_at_range: filters.job_posted_at_range,
    contact_email_status: filters.contact_email_status,
    icp_industries: icpIndustries.length ? icpIndustries : undefined,
    q_keywords: nicheKeyword || undefined,
  }
}

export interface ArchetypePreset {
  key: string
  label: string
  /** One-line description of who this preset targets. */
  description: string
  /** Starting draft — the rep edits it, then searches. */
  draft: ProspectDraft
}

// Default outbound posture — contactable contacts, Texas-first (per icp.md).
const OUTBOUND_EMAIL: ApolloEmailStatus[] = ["verified", "likely to engage"]
const TEXAS: string[] = ["Texas, US"]

/**
 * The four 434media buyer archetypes as click-to-load presets. Titles/seniorities
 * combine Tier-1 (Economic Buyer) + Tier-2 (Champion) from icp.md so outbound can
 * open on the Champion. Reps edit before searching.
 */
export const ARCHETYPE_PRESETS: ArchetypePreset[] = [
  {
    key: "sponsor-buyers",
    label: "Sponsor-buyers",
    description: "Brands that buy audience access / sponsorship in our channels",
    draft: {
      organization_locations: TEXAS,
      person_titles: [
        "CMO",
        "VP Marketing",
        "VP Brand",
        "Head of Partnerships",
        "Head of Sponsorships",
        "Brand Director",
      ],
      person_seniorities: ["c_suite", "vp", "head", "director"],
      num_employees_ranges: ["51,1000"],
      revenue_range: { min: 20000000 },
      icp_industries: ["cpg_consumer", "sports_fitness_lifestyle", "healthcare_life_sciences"],
      contact_email_status: OUTBOUND_EMAIL,
    },
  },
  {
    key: "storytelling-clients",
    label: "Storytelling clients",
    description: "Founders / institutions needing video, documentary, brand work",
    draft: {
      organization_locations: TEXAS,
      person_titles: [
        "Founder",
        "CEO",
        "Executive Director",
        "Communications Director",
        "Marketing Director",
        "Head of Brand",
      ],
      person_seniorities: ["founder", "c_suite", "director", "head"],
      num_employees_ranges: ["5,500"],
      revenue_range: { min: 500000 },
      icp_industries: ["healthcare_life_sciences", "nonprofit_mission", "education_workforce"],
      contact_email_status: OUTBOUND_EMAIL,
    },
  },
  {
    key: "event-partners",
    label: "Event partners",
    description: "Orgs running events that need production / audience-building",
    draft: {
      organization_locations: TEXAS,
      person_titles: [
        "Executive Director",
        "Founder",
        "CEO",
        "Program Director",
        "Director of Events",
      ],
      person_seniorities: ["founder", "c_suite", "director"],
      icp_industries: ["healthcare_life_sciences", "civic_econ_dev", "capital_vc"],
      contact_email_status: OUTBOUND_EMAIL,
    },
  },
  {
    key: "ecosystem-amplifiers",
    label: "Ecosystem amplifiers",
    description: "VCs / accelerators buying cohort or portfolio storytelling",
    draft: {
      organization_locations: TEXAS,
      person_titles: [
        "Managing Partner",
        "General Partner",
        "Partner",
        "Director of Storytelling",
        "Head of Platform",
        "Portfolio Marketing",
      ],
      person_seniorities: ["partner", "c_suite", "director", "head"],
      num_employees_ranges: ["2,100"],
      icp_industries: ["capital_vc"],
      contact_email_status: OUTBOUND_EMAIL,
    },
  },
]
