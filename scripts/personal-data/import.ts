/**
 * One-time import of the personal data that used to be hard-coded in this public repository:
 *
 *   lib/event-roles/sa-tech-day-2026.ts  → event_role_overlays/sa-tech-day-2026
 *   lib/travel/projects.ts               → travel_projects/<project-slug>
 *
 *   npx tsx scripts/personal-data/import.ts [--from-commit <sha>] [--env-dir ~/434] [--production] [--apply]
 *
 * The data is read out of git history at --from-commit (default: the last main commit that had both files), not
 * from a copy, so nothing new is written to disk beyond a temporary file under the OS temp directory, removed on exit.
 *
 * Dry run by default: it prints what it would create, as counts, never addresses or names. --apply writes. Every
 * write is a create on a stable document id, so an existing document is skipped and never overwritten, and a second
 * run is a no-op. After writing it reads each document back through the same module the app reads with and checks
 * the counts, exiting 1 on any mismatch.
 *
 * The database is the emulator when FIRESTORE_EMULATOR_HOST is set; production only with --production (reads too).
 * A production --apply is the step that needs the founder's typed approval.
 */
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { scriptDb } from "../brand-profiles/load"
import {
  createEventRoleOverlayIfAbsent,
  getEventRoleOverlay,
  invalidateEventRoleOverlaysCache,
  normalizeEventRoleOverlay,
} from "../../lib/firestore-event-role-overlays"
import {
  createTravelProjectIfAbsent,
  getTravelProjectRecord,
  invalidateTravelProjectsCache,
  normalizeTravelProject,
  type TravelProject,
  type TravelProjectInput,
} from "../../lib/firestore-travel-projects"

const argv = process.argv.slice(2)
const flag = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined }
const APPLY = argv.includes("--apply")
/** origin/main when the files were removed (next-434media #241's merge). */
const FROM_COMMIT = flag("--from-commit") ?? "49edb0c"

const EVENT_SLUG = "sa-tech-day-2026"
/** The old file's arrays, by the role tag each one added. */
const ROLE_FIELDS: Record<string, string> = {
  speakers: "role:tech-day-speaker",
  pitchCompanies: "role:tech-fuel-pitch-company",
  semifinalJudges: "role:tech-fuel-semifinal-judge",
}

async function fromHistory<T>(dir: string, path: string): Promise<T> {
  const source = execFileSync("git", ["show", `${FROM_COMMIT}:${path}`], { encoding: "utf8", maxBuffer: 1 << 20 })
  const file = join(dir, path.replace(/[^a-z0-9.]+/gi, "_"))
  writeFileSync(file, source, { mode: 0o600 })
  return (await import(pathToFileURL(file).href)) as T
}

export function rolesFromLegacy(legacy: Record<string, unknown>): Record<string, string[]> {
  const roles: Record<string, string[]> = {}
  for (const [field, tag] of Object.entries(ROLE_FIELDS)) {
    if (!Array.isArray(legacy[field])) throw new Error(`the old role file has no ${field} array`)
    roles[tag] = legacy[field] as string[]
  }
  return normalizeEventRoleOverlay(EVENT_SLUG, { roles }).roles
}

export function projectsFromLegacy(legacy: Record<string, unknown>): TravelProjectInput[] {
  return Object.entries(legacy).map(([slug, raw]) => {
    const p = normalizeTravelProject(slug, raw as FirebaseFirestore.DocumentData)
    return { slug: p.slug, client: p.client, purpose: p.purpose, year: p.year, startDate: p.startDate, endDate: p.endDate, airtableBaseId: p.airtableBaseId, travelers: p.travelers }
  })
}

const roleCounts = (roles: Record<string, string[]>) =>
  Object.fromEntries(Object.entries(roles).map(([tag, emails]) => [tag, emails.length]))
const projectShape = (p: Pick<TravelProject, "travelers" | "startDate" | "endDate" | "airtableBaseId">) => ({
  dates: `${p.startDate}..${p.endDate}`,
  airtableBase: p.airtableBaseId ? "set" : "missing",
  travelers: Object.fromEntries(Object.entries(p.travelers).map(([slug, t]) => [slug, `${t.routeStops.length} stops`])),
})
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

async function main() {
  const envDir = flag("--env-dir")
  if (envDir) {
    const { createRequire } = await import("node:module")
    const fromNext = createRequire(createRequire(import.meta.url).resolve("next/package.json"))
    ;(fromNext("@next/env") as { loadEnvConfig: (dir: string, dev?: boolean, log?: unknown) => unknown }).loadEnvConfig(envDir, false, { info: () => {}, error: console.error })
  }

  const dir = mkdtempSync(join(tmpdir(), "personal-data-import-"))
  let roles: Record<string, string[]>
  let projects: TravelProjectInput[]
  try {
    const rolesModule = await fromHistory<{ SA_TECH_DAY_2026_ROLES: Record<string, unknown> }>(dir, "lib/event-roles/sa-tech-day-2026.ts")
    const travelModule = await fromHistory<{ TRAVEL_PROJECTS: Record<string, unknown> }>(dir, "lib/travel/projects.ts")
    roles = rolesFromLegacy(rolesModule.SA_TECH_DAY_2026_ROLES)
    projects = projectsFromLegacy(travelModule.TRAVEL_PROJECTS)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }

  const { db, target } = await scriptDb(argv.includes("--production"))
  console.log(`source: git ${FROM_COMMIT}`)
  console.log(`target: ${target}`)
  console.log(APPLY ? "mode: APPLY (create-or-skip)" : "mode: dry run (nothing is written; pass --apply to write)")
  let failed = false

  // Event role overlay.
  const wantRoles = roleCounts(roles)
  const existingOverlay = await getEventRoleOverlay(EVENT_SLUG, db)
  if (existingOverlay) {
    const ok = same(roleCounts(existingOverlay.roles), wantRoles) && same(existingOverlay.roles, roles)
    console.log(`event_role_overlays/${EVENT_SLUG}: exists, skipped; ${ok ? "matches the source" : "DIFFERS from the source (left as it is)"}`)
  } else if (!APPLY) {
    console.log(`event_role_overlays/${EVENT_SLUG}: would create ${JSON.stringify(wantRoles)}`)
  } else {
    const { created } = await createEventRoleOverlayIfAbsent(EVENT_SLUG, roles, db)
    invalidateEventRoleOverlaysCache()
    const back = await getEventRoleOverlay(EVENT_SLUG, db)
    const ok = !!back && same(back.roles, roles)
    if (!ok) failed = true
    console.log(`event_role_overlays/${EVENT_SLUG}: ${created ? "created" : "already existed"}; read back ${JSON.stringify(back ? roleCounts(back.roles) : null)} — ${ok ? "OK" : "MISMATCH"}`)
  }

  // Travel projects.
  for (const project of projects) {
    const want = projectShape(project)
    const existing = await getTravelProjectRecord(project.slug, db)
    if (existing) {
      const ok = same(projectShape(existing), want) && same(existing.travelers, project.travelers)
      console.log(`travel_projects/${project.slug}: exists, skipped; ${ok ? "matches the source" : "DIFFERS from the source (left as it is)"}`)
    } else if (!APPLY) {
      console.log(`travel_projects/${project.slug}: would create ${JSON.stringify(want)}`)
    } else {
      const { created } = await createTravelProjectIfAbsent(project, db)
      invalidateTravelProjectsCache()
      const back = await getTravelProjectRecord(project.slug, db)
      const ok = !!back && same(projectShape(back), want) && same(back.travelers, project.travelers)
        && back.client === project.client && back.purpose === project.purpose && back.year === project.year
      if (!ok) failed = true
      console.log(`travel_projects/${project.slug}: ${created ? "created" : "already existed"}; read back ${JSON.stringify(back ? projectShape(back) : null)} — ${ok ? "OK" : "MISMATCH"}`)
    }
  }

  if (failed) {
    console.error("Read-back did not match the source. Do not merge the code change until this is resolved.")
    process.exit(1)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
