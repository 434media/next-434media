/**
 * The Skills list on the Agents page (V1 item 4; founder 2026-11-19: "Approve"): what the generated catalog
 * (`03 Skills/skills-index.json` in 434-context) says of each skill, shaped for display. Display only: nothing here
 * starts, pins or changes a skill, and nothing is kept anywhere: the catalog is read fresh from the read-only GitHub
 * App on every view (lib/skills/source.ts), so the list is never a second, hand-kept copy.
 *
 * Only fields the catalog already publishes are shown. The parse is pure, so the tests run on an invented catalog.
 */
import { CATALOG_PATH, CONTEXT_REPO, SkillSourceError, readFileAt, resolveCommit, type SourceDeps } from "./source"

export interface SkillCard {
  name: string
  /** The description up to its "Use …" sentence: what the skill does (its steps, in brief). */
  does: string
  /** From the "Use …" sentence on: when to use it, and when not to. */
  when: string
  owner: string | null
  version: string | null
  status: string | null
  autonomyCeiling: string | null
  /** What the ceiling means for where the skill stops, in plain words. */
  stopPoint: string
  dataClass: string | null
  exam: { status: string; suites: number }
  brands: string[]
  /** The SOP's path in 434-context and its link there; null for a skill not yet given one. */
  sop: { path: string; url: string } | null
}

export interface SkillCatalogView {
  skills: SkillCard[]
  /** The 434-context commit the catalog was read at. */
  commit: string
}

const STOP_POINT: Record<string, string> = {
  draft: "Drafts only. A person carries out every step.",
  approval: "Stops for your approval before anything is sent or published.",
  autonomous: "May act on its own, within its tools.",
}

/** Display names for the brand ids the catalog uses (CLAUDE.md, the CRM brand roster); an unknown id shows as is. */
const BRAND_NAMES: Record<string, string> = {
  "434": "434 MEDIA",
  milcity: "MilCityUSA",
  txmx: "TXMX Boxing",
  vemosvamos: "VemosVamos",
  devsa: "DEVSA",
  digitalcanvas: "Digital Canvas",
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null)

/**
 * Splits a catalog description at its first sentence that begins "Use" (or, failing one, "Runs only", "Not for" or
 * "Do not use"): before it, what the skill does; from it, when to use it and when not.
 */
export function splitDescription(description: string): { does: string; when: string } {
  const text = description.trim()
  // A description with no "Use" sentence says when through its limits ("Runs only on…", "Not for…") instead.
  const m = /(?<=[.!?…])\s+(?=Use\b)/.exec(text) ?? /(?<=[.!?…])\s+(?=(?:Runs only|Not for|Do not use)\b)/.exec(text)
  if (!m) return { does: text, when: "" }
  return { does: text.slice(0, m.index).trim(), when: text.slice(m.index).trim() }
}

export function sopUrl(path: string, commit = "main"): string {
  return `https://github.com/${CONTEXT_REPO.owner}/${CONTEXT_REPO.repo}/blob/${commit}/${path.split("/").map(encodeURIComponent).join("/")}`
}

/** The catalog's text, as cards, in the catalog's own order. Throws on text that is not the catalog. */
export function parseCatalog(catalogText: string): SkillCard[] {
  let parsed: { skills?: Record<string, Record<string, unknown>> }
  try {
    parsed = JSON.parse(catalogText)
  } catch {
    throw new SkillSourceError("The catalog is not JSON")
  }
  if (!parsed?.skills || typeof parsed.skills !== "object") throw new SkillSourceError("The catalog lists no skills")
  return Object.entries(parsed.skills).map(([name, e]) => {
    const { does, when } = splitDescription(str(e?.description) ?? "")
    const ceiling = str(e?.autonomy_ceiling)
    const exam = (e?.exam ?? {}) as { status?: unknown; suites?: unknown }
    const sop = str(e?.sop)
    return {
      name,
      does,
      when,
      owner: str(e?.owner),
      version: str(e?.version),
      status: str(e?.status),
      autonomyCeiling: ceiling,
      stopPoint: ceiling ? STOP_POINT[ceiling] ?? "—" : "Not declared, so it runs only as a draft.",
      dataClass: str(e?.data_class),
      exam: { status: str(exam.status) ?? "none", suites: Array.isArray(exam.suites) ? exam.suites.length : 0 },
      brands: Array.isArray(e?.properties) ? e.properties.filter((p): p is string => typeof p === "string").map((p) => BRAND_NAMES[p] ?? p) : [],
      sop: sop ? { path: sop, url: sopUrl(sop) } : null,
    }
  })
}

/** Reads the catalog on 434-context's `main` now, through the read-only App, and shapes it. */
export async function readSkillCatalog(deps: SourceDeps = {}): Promise<SkillCatalogView> {
  const commit = await resolveCommit("main", deps)
  return { skills: parseCatalog(await readFileAt(commit, CATALOG_PATH, deps)), commit }
}
