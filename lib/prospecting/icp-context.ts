import { promises as fs } from "fs"
import path from "path"
import type { OutboundCohort } from "@/lib/sor/types.generated"

/**
 * The ICP context the prospecting translator is prompted with
 * (next-434media#63): lib/prospecting/icp-base.md, the base ICP, plus the
 * outbound cohorts from `icp_cohorts`. The cohorts are the only targeting
 * source; the old lib/prospecting/icp.md and its file and shadow modes are gone.
 */

const ICP_BASE_PATH = path.join(process.cwd(), "lib/prospecting/icp-base.md")

// The file is part of the build, so it is stable for a deploy's life.
const fileCache = new Map<string, string>()
async function readOnce(p: string): Promise<string> {
  const hit = fileCache.get(p)
  if (hit !== undefined) return hit
  const content = await fs.readFile(p, "utf-8")
  fileCache.set(p, content)
  return content
}

/** icp-base.md without its leading HTML comment. */
export async function readIcpBase(): Promise<string> {
  return (await readOnce(ICP_BASE_PATH)).replace(/^<!--[\s\S]*?-->\n/, "")
}

function bullets(items: string[] | undefined): string {
  return (items ?? []).map((i) => `- ${i}`).join("\n")
}

/**
 * The cohorts as prompt context. Targeting fields only: what each cohort is,
 * who it targets and the signals that qualify a target. Proof, narrative and
 * pitch are for drafting, not for building a search, and are left out.
 *
 * So is the revenue floor. It is a qualification gate, and given to the
 * translator it became a search filter (E1, 2026-10-08) even under a rule
 * saying not to. A search filter on revenue comes only from the rep's own
 * words: see revenueFigureStated() in translator.ts.
 */
export function renderCohorts(cohorts: OutboundCohort[]): string {
  const blocks = cohorts.map((c) => {
    const parts = [`### Cohort ${c.letter} — ${c.name}`, "", `**Objective.** ${c.objective}`, "", "**Target profile:**", bullets(c.target_profile)]
    if (c.target_profile_notes) parts.push("", c.target_profile_notes)
    parts.push("", "**Qualification signals:**", bullets(c.qualification_signals))
    if (c.qualification_signal_notes) parts.push("", c.qualification_signal_notes)
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

/** The full ICP context: icp-base.md, then the cohorts. */
export async function cohortsContext(cohorts: OutboundCohort[]): Promise<string> {
  return `${await readIcpBase()}\n\n---\n\n${renderCohorts(cohorts)}\n`
}
