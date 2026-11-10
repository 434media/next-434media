import { BRAND_RECORDS } from "@/lib/brand-records"
import { COMMERCIAL_MODEL_DEFINITIONS } from "@/lib/commercial-models"
import { WORK_RECORDS, type WorkRecord } from "@/lib/work-records"
import { FAQS } from "@/lib/seo/faq"
import { SERVICES } from "@/lib/seo/services"

/**
 * /llms.txt and /llms-full.txt (llmstxt.org): what an agent reads first when
 * it is asked about 434 MEDIA.
 *
 * Built from the generated records, never written by hand, so it says only
 * what the site already says and cannot drift from it:
 *   - the 1.1 definition, the short descriptor and the plain motto from
 *     lib/brand-records.ts;
 *   - the 4.3 commercial-model definitions from lib/commercial-models.ts;
 *   - every published work record, title and description verbatim, from
 *     lib/work-records.ts (public fields only);
 *   - the services and FAQ answers the home page already carries.
 *
 * The hand-written version it replaces linked /events (a 404), left out the
 * Work page, wrote "SDOH" for ¿Qué es SDOH?, and described the brands in its
 * own words.
 */

const SITE = "https://www.434media.com"

// Master 8.1: "Marcos Resendez is the founder of 434 MEDIA".
const FACTS = [
  `- Headquarters: 816 Camaron St., Suite 1.11, San Antonio, TX 78212`,
  `- Contact: build@434media.com, or ${SITE}/contact to start a production`,
  `- Founder: Marcos Resendez`,
  `- Motto: ${BRAND_RECORDS.mottoPlain}`,
]

const PAGES = [
  `- [Home](${SITE}/): ${BRAND_RECORDS.shortDescriptor}`,
  `- [Work](${SITE}/work): selected work, organized by commercial model.`,
  `- [Start a production](${SITE}/contact): tell 434 MEDIA what you want to produce.`,
  `- [The Feed](${SITE}/thefeed): field notes from the work.`,
  `- [Demand Drives Performance](${SITE}/performance-marketing): how demand creation, demand capture and measurement work as one system.`,
  `- [Lead with Ops. Layer in AI.](${SITE}/workshops/lead-with-ops): an executive working lunch, June 18, 2026.`,
  `- [Blog](${SITE}/blog): news and stories from the studio.`,
  `- [Shop](${SITE}/shop): TXMX Boxing apparel.`,
]

const MODELS = Object.keys(COMMERCIAL_MODEL_DEFINITIONS)

function byModel(records: readonly WorkRecord[]) {
  return MODELS.map((model) => ({ model, records: records.filter((r) => r.model === model) })).filter(
    (g) => g.records.length > 0,
  )
}

function workLine(r: WorkRecord) {
  const meta = [r.categories, r.years].filter(Boolean).join("; ")
  const site = r.publicUrl ? ` ${r.publicUrl}` : ""
  return `- **${r.title}**${meta ? ` (${meta})` : ""}: ${r.description ?? ""}${site}`.trimEnd()
}

function workDetail(r: WorkRecord) {
  const rows: Array<[string, string | null]> = [
    ["Commercial model", r.model],
    ["Categories", r.categories],
    ["Client", r.client],
    ["434 MEDIA's role", r.role],
    ["Founder credit", r.founderCredit],
    ["Collaborators", r.collaboratorCredit],
    ["Years", r.years],
    ["Status", r.status],
    ["Site", r.publicUrl],
  ]
  return [
    `### ${r.title}`,
    "",
    r.description ?? "",
    "",
    ...rows.filter(([, v]) => v).map(([k, v]) => `- ${k}: ${v}`),
  ].join("\n")
}

const header = () =>
  [`# 434 MEDIA`, "", `> ${BRAND_RECORDS.canonicalDefinition}`, "", ...FACTS, "", `## Key pages`, "", ...PAGES].join("\n")

export function buildLlmsTxt(records: readonly WorkRecord[] = WORK_RECORDS) {
  const work = byModel(records).flatMap(({ model, records }) => [
    "",
    `### ${model}`,
    "",
    COMMERCIAL_MODEL_DEFINITIONS[model],
    "",
    ...records.map(workLine),
  ])
  return [
    header(),
    "",
    `## Work`,
    "",
    `Selected work from ${SITE}/work, by commercial model.`,
    ...work,
    "",
    `## More`,
    "",
    `- [Full text for agents](${SITE}/llms-full.txt): every work record in full, the services and the FAQ.`,
    `- [Sitemap](${SITE}/sitemap.xml)`,
    "",
  ].join("\n")
}

export function buildLlmsFullTxt(records: readonly WorkRecord[] = WORK_RECORDS) {
  const work = byModel(records).flatMap(({ model, records }) => [
    "",
    `## ${model}`,
    "",
    COMMERCIAL_MODEL_DEFINITIONS[model],
    "",
    ...records.flatMap((r) => [workDetail(r), ""]),
  ])
  return [
    header(),
    "",
    `## Services`,
    "",
    ...SERVICES.map((s) => `- **${s.name}**: ${s.description}`),
    "",
    `## Questions`,
    "",
    ...FAQS.flatMap((f) => [`### ${f.question}`, "", f.answer, ""]),
    `# Work`,
    "",
    `Selected work from ${SITE}/work.`,
    ...work,
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
}
