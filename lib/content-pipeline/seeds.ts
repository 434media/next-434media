import type { RequestKind } from "./series"

/**
 * MCU content seeds: where research looks first, and the DT101 ideas waiting to be made. The values are a copy of the
 * founder's Tracker (a private Google Sheet) and his named organizations, so they are not in this public repository:
 * they live in Firestore (lib/firestore-content-pipeline.ts, `content_pipeline_config/mcu_seeds`) and are loaded by a
 * super-admin through PUT /api/admin/content-pipeline/seeds. Only their shape and the brief built from them are here.
 * Without seeds, research still runs on the editorial rules alone, and the run records that it did.
 */
export const SEED_ORG_KINDS = ["neo-prime", "prime", "government", "research", "ecosystem", "outlet"] as const
export interface SeedOrg { name: string; site: string; kind: typeof SEED_ORG_KINDS[number] }
export interface McuSeeds {
  purpose: string
  cohorts: string[]
  orgs: SeedOrg[]
  /** DT101 ideas from the Tracker, each with its official page. */
  dt101Backlog: { subject: string; maker: string; url: string }[]
  /** Subjects already covered as DT101 (never proposed again). */
  dt101Covered: string[]
  /** Where the copy came from, e.g. "Tracker, modified 2026-10-14". */
  snapshot: string
  updatedAt?: string
  updatedBy?: string
}

/** The research brief: purpose, cohorts and where to look first. */
export function seedBrief(kind: RequestKind, seeds: McuSeeds | null): string {
  if (!seeds) return "No source seeds are loaded: find stories from primary sources on your own, under the rules above."
  const list = (kinds: SeedOrg["kind"][], withSite = true) => seeds.orgs.filter(o => kinds.includes(o.kind)).map(o => withSite ? `${o.name} (${o.site})` : o.name).join(", ")
  return [
    seeds.purpose,
    `Source cohorts:\n${seeds.cohorts.map(c => `- ${c}`).join("\n")}`,
    `Look first at these builders' own newsrooms: ${list(["neo-prime"])}. Primes: ${list(["prime"], false)}. Government, research and ecosystem: ${list(["government", "research", "ecosystem"])}. Outlets for finding stories (then cite the primary source): ${seeds.orgs.filter(o => o.kind === "outlet").map(o => o.site).join(", ")}. These are a starting point, not a limit.`,
    ...(kind === "dt101" ? [`DT101 ideas waiting to be made (prefer one of these unless the reviewer steers otherwise; already covered: ${seeds.dt101Covered.join(", ") || "none listed"}):\n${seeds.dt101Backlog.map(b => `- ${b.subject} — ${b.maker} (${b.url})`).join("\n")}`] : []),
  ].join("\n\n")
}

/** Validates a seeds document from the admin route; returns problems (empty = usable). */
export function seedProblems(v: unknown): string[] {
  const s = v as Partial<McuSeeds> | null
  const p: string[] = []
  const str = (x: unknown, max: number) => typeof x === "string" && x.trim().length > 0 && x.length <= max
  if (!s || typeof s !== "object") return ["seeds must be an object"]
  if (!str(s.purpose, 2000)) p.push("purpose: 1–2,000 characters")
  if (!str(s.snapshot, 300)) p.push("snapshot: 1–300 characters")
  if (!Array.isArray(s.cohorts) || s.cohorts.length > 20 || !s.cohorts.every(c => str(c, 500))) p.push("cohorts: up to 20 lines of at most 500 characters")
  if (!Array.isArray(s.orgs) || s.orgs.length > 200 || !s.orgs.every(o => o && str(o.name, 120) && str(o.site, 120) && (SEED_ORG_KINDS as readonly string[]).includes(o.kind))) p.push(`orgs: up to 200 of {name, site, kind: ${SEED_ORG_KINDS.join(" | ")}}`)
  if (!Array.isArray(s.dt101Backlog) || s.dt101Backlog.length > 100 || !s.dt101Backlog.every(b => b && str(b.subject, 200) && str(b.maker, 120) && typeof b.url === "string" && /^https:\/\//.test(b.url) && b.url.length <= 500)) p.push("dt101Backlog: up to 100 of {subject, maker, url (https)}")
  if (!Array.isArray(s.dt101Covered) || s.dt101Covered.length > 100 || !s.dt101Covered.every(c => str(c, 200))) p.push("dt101Covered: up to 100 subjects")
  return p
}
