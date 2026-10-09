import { promises as fs } from "fs"
import path from "path"
import type { OutboundCohort } from "@/lib/sor/types.generated"

/**
 * The ICP context the prospecting translator is prompted with
 * (next-434media#63).
 *
 *   file    — lib/prospecting/icp.md, as before. The default.
 *   cohorts — lib/prospecting/icp-base.md (icp.md without its buyer
 *             archetypes) plus the outbound cohorts from `icp_cohorts`.
 *   shadow  — translate both ways, use the `file` result, log the difference.
 *
 * Set with PROSPECTING_ICP_SOURCE. icp.md stays and runs alongside until the
 * evals agree; it is removed in a follow-up.
 */
export type IcpSource = "file" | "shadow" | "cohorts"

export function parseIcpSource(value: string | undefined): IcpSource {
  return value === "cohorts" || value === "shadow" ? value : "file"
}

export function icpSourceFromEnv(): IcpSource {
  return parseIcpSource(process.env.PROSPECTING_ICP_SOURCE)
}

/** The section of icp.md that the cohorts replace. */
export const ARCHETYPES_HEADING = "## Buyer archetypes (Apollo WHO/WHEN persona model)"

/** icp.md without its buyer-archetypes section — what icp-base.md must equal. */
export function withoutArchetypes(icp: string): string {
  const lines = icp.split("\n")
  const start = lines.indexOf(ARCHETYPES_HEADING)
  const end = lines.indexOf("## Geography")
  if (start < 0 || end < start) return icp
  return [...lines.slice(0, start), ...lines.slice(end)].join("\n")
}

const ICP_PATH = path.join(process.cwd(), "lib/prospecting/icp.md")
const ICP_BASE_PATH = path.join(process.cwd(), "lib/prospecting/icp-base.md")

// Both files are part of the build, so they are stable for a deploy's life.
const fileCache = new Map<string, string>()
async function readOnce(p: string): Promise<string> {
  const hit = fileCache.get(p)
  if (hit !== undefined) return hit
  const content = await fs.readFile(p, "utf-8")
  fileCache.set(p, content)
  return content
}

export function readIcpFile(): Promise<string> {
  return readOnce(ICP_PATH)
}

/** icp-base.md without its leading HTML comment. */
export async function readIcpBase(): Promise<string> {
  return (await readOnce(ICP_BASE_PATH)).replace(/^<!--[\s\S]*?-->\n/, "")
}

function bullets(items: string[] | undefined): string {
  return (items ?? []).map((i) => `- ${i}`).join("\n")
}

function money(floor: OutboundCohort["revenue_floor"]): string | null {
  if (!floor) return null
  const major = floor.amount_minor / 100
  return `${floor.currency} ${major.toLocaleString("en-US")}`
}

/**
 * The cohorts as prompt context. Targeting fields only: what each cohort is,
 * who it targets and the signals that qualify a target. Proof, narrative and
 * pitch are for drafting, not for building a search, and are left out.
 */
export function renderCohorts(cohorts: OutboundCohort[]): string {
  const blocks = cohorts.map((c) => {
    const parts = [`### Cohort ${c.letter} — ${c.name}`, "", `**Objective.** ${c.objective}`, "", "**Target profile:**", bullets(c.target_profile)]
    if (c.target_profile_notes) parts.push("", c.target_profile_notes)
    parts.push("", "**Qualification signals:**", bullets(c.qualification_signals))
    if (c.qualification_signal_notes) parts.push("", c.qualification_signal_notes)
    const floor = money(c.revenue_floor)
    if (floor) parts.push("", `**Revenue floor:** ${floor} annual revenue.`)
    return parts.join("\n")
  })
  return [
    "## Outbound cohorts (canonical — the system of record's icp_cohorts)",
    "",
    "434 pursues these five outbound cohorts. When a query names or implies one, build the search from that cohort's target profile and qualification signals.",
    "",
    blocks.join("\n\n"),
  ].join("\n")
}

/** The full cohorts-mode context: icp-base.md, then the cohorts. */
export async function cohortsContext(cohorts: OutboundCohort[]): Promise<string> {
  return `${await readIcpBase()}\n\n---\n\n${renderCohorts(cohorts)}\n`
}
