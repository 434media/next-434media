import type { BrandProfile } from "./profile"
import type { BrandType } from "./profile-store"

/**
 * The Brands area (plan v11.2.1 Step 4 item 2): what a brand's page shows besides its profile editor. Client-safe and
 * pure: the routes read the database and pass the facts in, so the list, the page and the tests share one reading.
 *
 * The onboarding checklist follows the seven steps of the Brand Onboarding SOP (06 Standards/Brand Profiles/
 * Brand_Onboarding_SOP.md). Each step is ticked only from what the system can see (the brand's document, its published
 * profile, its seeds, its posts); a step that rests on a person's decision says so and stays open until it can be seen.
 * Steps 6 and 7 read v11's way in: a test row made under a published version, then the published version itself
 * (draft → Publish replaced the profile pull requests).
 */
export type CheckStatus = "done" | "open"
export interface CheckItem { step: number; title: string; status: CheckStatus; detail: string }

/** The facts a brand's checklist and status are read from. */
export interface BrandFacts {
  id: string
  label: string
  /** On the CRM roster (PIPELINE_PROPERTIES); a client brand is not. */
  onRoster: boolean
  brandType: BrandType | null
  /** The brand's document exists in brand_profiles. */
  hasDocument: boolean
  identity: { source: string; record: string } | null
  sources: { seeds: string | null; note?: string } | null
  /** The published version, valid for the engine; null when none is, with the reason. */
  published: { versionId: string; profile: BrandProfile; publishedAt: string; publishedBy: string } | null
  publishedProblem: string | null
  draftDiffers: boolean
  /** The seeds document the profile points at, when it is loaded (its snapshot line), or null. */
  seeds: { snapshot: string; orgs: number; cohorts: number; backlog: number; updatedAt?: string } | null
  /** Content posts stamped with one of the brand's published versions. */
  postsMade: number
  /** The publisher knows the brand's Meta id (META_BRANDS). */
  publisherBrands: readonly string[]
  /** A generated brand book exists for the brand (Step 4 item 3). */
  brandBook: boolean
}

export type BrandState = "live" | "draft" | "not_started"
export const BRAND_STATE_LABEL: Record<BrandState, string> = { live: "Live", draft: "Being set up", not_started: "Not started" }
export function brandState(f: Pick<BrandFacts, "published" | "hasDocument">): BrandState {
  return f.published ? "live" : f.hasDocument ? "draft" : "not_started"
}

const FORMAT_ASPECT = { feed: "4:5", reels: "9:16" } as const
/**
 * The templates a brand doesn't have yet, in the table's words ("No 9:16 News template for MilCityUSA yet"): every
 * request kind's series in each format, except a roundup's 9:16 (it is a 4:5 carousel). Then a missing brand book.
 */
export function missingTemplates(profile: BrandProfile | null, label: string, brandBook: boolean): string[] {
  const out: string[] = []
  if (!profile) out.push(`No published profile for ${label} yet, so no templates are connected`)
  for (const k of profile?.requestKinds ?? []) {
    for (const key of k.series) {
      const s = profile!.series[key]
      for (const f of k.minStories ? (["feed"] as const) : (["feed", "reels"] as const)) {
        if (!s?.templates[f]) out.push(`No ${FORMAT_ASPECT[f]} ${s?.label ?? k.label} template for ${label} yet`)
      }
    }
  }
  if (!brandBook) out.push(`No brand book yet for ${label}`)
  return out
}

export function onboardingChecklist(f: BrandFacts): CheckItem[] {
  const p = f.published?.profile ?? null
  const feedGaps = p ? p.requestKinds.flatMap(k => k.series.filter(s => !p.series[s]?.templates.feed).map(s => p.series[s]?.label ?? s)) : []
  const metaBrand = p?.posts.metaBrand
  return [
    {
      step: 1, title: "Identity, from the master",
      status: f.identity?.source && f.identity.record ? "done" : "open",
      detail: f.identity?.source ? `References ${f.identity.record} in ${f.identity.source}; nothing restated.${f.onRoster ? " On the CRM roster." : f.brandType === "client" ? " A client brand: not on the CRM roster." : ""}` : "The profile's document has no identity reference yet.",
    },
    {
      step: 2, title: "Voice and editorial rules",
      status: p?.editorial?.trim() && p.headlineRules?.trim() ? "done" : "open",
      detail: p ? `Editorial and headline rules are in ${f.published!.versionId}${p.checks ? ", with checks on" : ""}.` : "Written in the draft and checked on Publish.",
    },
    {
      step: 3, title: "Canva templates, with every autofill field connected",
      status: p && !feedGaps.length ? "done" : "open",
      detail: !p ? "No published template map yet." : feedGaps.length ? `No 4:5 template yet for ${feedGaps.join(", ")}.` : `Every template has a 4:5 brand template (${p.requestKinds.length} templates). The visual standard's surface subsections are the founder's to approve.`,
    },
    {
      step: 4, title: "Sources and seeds",
      status: f.sources?.seeds && f.seeds ? "done" : "open",
      detail: f.seeds ? `Seeds loaded: ${f.seeds.snapshot} (${f.seeds.orgs} organizations, ${f.seeds.cohorts} cohorts${f.seeds.backlog ? `, ${f.seeds.backlog} backlog ideas` : ""}).` : f.sources?.seeds ? `The profile points at ${f.sources.seeds}, which is not loaded.` : "No seeds named yet. The founder supplies or approves the source list.",
    },
    {
      step: 5, title: "Accounts and Meta access",
      status: metaBrand && f.publisherBrands.includes(metaBrand) ? "done" : "open",
      detail: metaBrand ? (f.publisherBrands.includes(metaBrand) ? `The publisher posts as "${metaBrand}". The accounts' portfolio placement is recorded under the Meta Account Governance SOP.` : `The profile names "${metaBrand}", which the publisher doesn't know yet.`) : "No publisher brand id yet.",
    },
    {
      step: 6, title: "A test batch",
      status: f.postsMade > 0 ? "done" : "open",
      detail: f.postsMade > 0 ? `${f.postsMade} post${f.postsMade === 1 ? "" : "s"} made under a published version.` : "No post has been made under a published version yet. Make 2–3 test rows in Create.",
    },
    {
      step: 7, title: "Published",
      status: f.published ? "done" : "open",
      detail: f.published ? `Live as ${f.published.versionId}, published by ${f.published.publishedBy} on ${f.published.publishedAt.slice(0, 10)}.${f.draftDiffers ? " The draft has unpublished edits." : ""}` : f.publishedProblem ? `Not live: ${f.publishedProblem}` : "Not published yet.",
    },
  ]
}
