/**
 * The Skills list on the Agents page (V1 item 4; founder 2026-11-19: "Approve"): what the generated catalog
 * (`03 Skills/skills-index.json` in 434-context) says of each skill, shaped for display. Display only: nothing here
 * starts, pins or changes a skill, and nothing is kept anywhere: the catalog is read fresh from the read-only GitHub
 * App on every view (lib/skills/source.ts), so the list is never a second, hand-kept copy.
 *
 * Only fields the catalog already publishes are shown. The parse is pure, so the tests run on an invented catalog.
 */
import { CATALOG_PATH, CONTEXT_REPO, SkillSourceError, readFileAt, resolveCommit, type SourceDeps } from "./source"

export interface SkillStep {
  text: string
  /** The step where the skill stops for a person. */
  waits: boolean
}

export interface SkillCard {
  /** The skill's real name, as the code base and 434-context call it. */
  name: string
  /** The plain name from the skill's card (card.json in 434-context); the real name when it has no card. */
  label: string
  /** One line: what it does. From the card, or the description's first sentence. */
  summary: string
  /** When it runs, from the card; empty without one (the long "when" below stands in). */
  runsWhen: string
  /** Four to six plain steps from the card, the stop marked; empty without one. */
  steps: SkillStep[]
  /** What it is not for, from the card, or the description's "Not for" / "Do not use" sentences. */
  notFor: string
  /** True when the plain fields came from the skill's card rather than the long description. */
  hasCard: boolean
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

/** The first sentence of a text (up to its first ". " or the dash that opens a list), for a one-line fallback. */
function firstSentence(text: string): string {
  const cut = text.split(/\s+—\s+|(?<=[.!?])\s+/)[0] ?? text
  return cut.replace(/[.:]$/, "")
}

/** The description's "Not for…" / "Do not use…" sentences, for the fallback "Not for". */
function notForOf(text: string): string {
  const m = /(?:^|(?<=[.!?…])\s+)((?:Not for|Do not use)\b[\s\S]*)$/.exec(text)
  return m ? m[1].trim() : ""
}

function cardOf(v: unknown): { label: string; summary: string; when: string; steps: SkillStep[]; not_for: string } | null {
  if (!v || typeof v !== "object") return null
  const c = v as Record<string, unknown>
  const label = str(c.label)
  if (!label) return null
  const steps = Array.isArray(c.steps)
    ? c.steps.flatMap((s) => {
        const t = str((s as { text?: unknown })?.text)
        return t ? [{ text: t, waits: (s as { waits?: unknown }).waits === true }] : []
      })
    : []
  return { label, summary: str(c.summary) ?? "", when: str(c.when) ?? "", steps, not_for: str(c.not_for) ?? "" }
}

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
    const card = cardOf(e?.card)
    return {
      name,
      label: card?.label ?? name,
      summary: card?.summary || firstSentence(does),
      runsWhen: card?.when ?? "",
      steps: card?.steps ?? [],
      notFor: card?.not_for || notForOf(when),
      hasCard: card !== null,
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
