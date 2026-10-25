/**
 * One-time import of the last two live addresses that were hard-coded in this public repository:
 *
 *   lib/lead-with-ops-call-request.ts (the call-request `to` fallback) → notification_routes/lead-with-ops-call-request
 *   scripts/offboard-interns.ts (SKIP_EMAILS)                          → offboard_skip: true on that crm_team_members record
 *
 *   npx tsx scripts/personal-data/import-pending.ts [--from-commit <sha>] [--env-dir ~/434] [--production] [--apply]
 *
 * The addresses are read out of git history at --from-commit (default: the last main commit that had both), not from
 * a copy, and are never printed: output is counts and states only.
 *
 * Dry run by default. --apply writes. The route is a create on a stable id, so an existing route is skipped and never
 * overwritten; the flag is set only where it is not already true. A second run is a no-op. After writing it reads
 * back and exits 1 on any mismatch.
 *
 * The database is the emulator when FIRESTORE_EMULATOR_HOST is set; production only with --production (reads too).
 * A production --apply is the step that needs the founder's typed approval.
 */
import { execFileSync } from "node:child_process"
import { pathToFileURL } from "node:url"
import { scriptDb } from "../brand-profiles/load"
import {
  createNotificationRouteIfAbsent,
  getNotificationRoute,
  invalidateNotificationRoutesCache,
} from "../../lib/firestore-notification-routes"

const argv = process.argv.slice(2)
const flag = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined }
const APPLY = argv.includes("--apply")
/** The last main commit that still has both addresses: #245's merge, which this branch was cut from. */
const FROM_COMMIT = flag("--from-commit") ?? "0a56ca6"

const ROUTE_ID = "lead-with-ops-call-request"
const ROUTE_CC = ["marcos@434media.com"]
/** As scripts/offboard-interns.ts names it. */
const TEAM_MEMBERS = "crm_team_members"

const show = (path: string) =>
  execFileSync("git", ["show", `${FROM_COMMIT}:${path}`], { encoding: "utf8", maxBuffer: 1 << 20 })

/** The single quoted address in `pattern`'s first group, lowercased. Throws when the file no longer has it. */
export function addressFrom(source: string, pattern: RegExp, what: string): string {
  const m = source.match(pattern)
  const list = m ? [...m[1].matchAll(/"([^"]+@[^"]+)"/g)].map((x) => x[1].trim().toLowerCase()) : []
  if (list.length !== 1) throw new Error(`expected one address for ${what} at ${FROM_COMMIT}, found ${list.length}`)
  return list[0]
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

async function main() {
  const envDir = flag("--env-dir")
  if (envDir) {
    const { createRequire } = await import("node:module")
    const fromNext = createRequire(createRequire(import.meta.url).resolve("next/package.json"))
    ;(fromNext("@next/env") as { loadEnvConfig: (dir: string, dev?: boolean, log?: unknown) => unknown }).loadEnvConfig(envDir, false, { info: () => {}, error: console.error })
  }

  const partner = addressFrom(
    show("lib/lead-with-ops-call-request.ts"),
    /LEAD_WITH_OPS_CALL_REQUEST_TO,\s*\[([^\]]*)\]/,
    "the call-request recipient",
  )
  const skip = addressFrom(show("scripts/offboard-interns.ts"), /SKIP_EMAILS\s*=\s*\[([^\]]*)\]/, "the offboarding skip list")

  const { db, target } = await scriptDb(argv.includes("--production"))
  console.log(`source: git ${FROM_COMMIT}`)
  console.log(`target: ${target}`)
  console.log(APPLY ? "mode: APPLY (create-or-skip)" : "mode: dry run (nothing is written; pass --apply to write)")
  let failed = false

  // Notification route.
  const want = { to: [partner], cc: ROUTE_CC }
  const existing = await getNotificationRoute(ROUTE_ID, db)
  if (existing) {
    const ok = same({ to: existing.to, cc: existing.cc }, want)
    console.log(`notification_routes/${ROUTE_ID}: exists, skipped; ${ok ? "matches the source" : "DIFFERS from the source (left as it is)"}`)
  } else if (!APPLY) {
    console.log(`notification_routes/${ROUTE_ID}: would create {to: 1, cc: ${ROUTE_CC.length}}`)
  } else {
    const { created } = await createNotificationRouteIfAbsent(ROUTE_ID, want, db)
    invalidateNotificationRoutesCache()
    const back = await getNotificationRoute(ROUTE_ID, db)
    const ok = !!back && same({ to: back.to, cc: back.cc }, want)
    if (!ok) failed = true
    console.log(`notification_routes/${ROUTE_ID}: ${created ? "created" : "already existed"}; read back — ${ok ? "OK" : "MISMATCH"}`)
  }

  // Offboarding skip flag. The stored email may differ in case, so match on the lowercased form.
  const members = db.collection(TEAM_MEMBERS)
  const snap = await members.get()
  const matches = snap.docs.filter((d) => String((d.data() as { email?: unknown }).email ?? "").trim().toLowerCase() === skip)
  if (matches.length === 0) {
    console.log(`${TEAM_MEMBERS}: no record for the skip address; nothing to flag (an offboarding run has nothing of it to remove)`)
  }
  for (const doc of matches) {
    const already = (doc.data() as { offboard_skip?: unknown }).offboard_skip === true
    if (already) {
      console.log(`${TEAM_MEMBERS}/${doc.id}: offboard_skip already true, skipped`)
    } else if (!APPLY) {
      console.log(`${TEAM_MEMBERS}/${doc.id}: would set offboard_skip: true`)
    } else {
      await doc.ref.update({ offboard_skip: true, updated_at: new Date().toISOString() })
      const back = (await doc.ref.get()).data() as { offboard_skip?: unknown } | undefined
      const ok = back?.offboard_skip === true
      if (!ok) failed = true
      console.log(`${TEAM_MEMBERS}/${doc.id}: set offboard_skip: true; read back — ${ok ? "OK" : "MISMATCH"}`)
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
