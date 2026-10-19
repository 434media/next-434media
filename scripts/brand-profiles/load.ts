import { readFileSync } from "node:fs"
import { loadProfile } from "../../lib/content-pipeline/profile"
import { profileSha256 } from "../../lib/content-pipeline/profile-store"
import { setProcessProfile, type ActiveProfile } from "../../lib/content-pipeline/brand"

/**
 * The database a script reads and writes. Never production by default:
 * - with FIRESTORE_EMULATOR_HOST set, the emulator, under a "demo-" project id, which the Firebase SDKs never send to
 *   Google (the production key is not loaded at all);
 * - otherwise production, only when the caller passes allowProduction (a script's explicit --production flag);
 * - otherwise an error.
 */
export async function scriptDb(allowProduction = false): Promise<{ db: FirebaseFirestore.Firestore; target: string }> {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    const [{ initializeApp, getApps }, { getFirestore }] = await Promise.all([import("firebase-admin/app"), import("firebase-admin/firestore")])
    const projectId = process.env.EMULATOR_PROJECT_ID ?? "demo-434-brand-profiles"
    if (!projectId.startsWith("demo-")) throw new Error("EMULATOR_PROJECT_ID must start with demo- so nothing can reach a real project")
    const app = getApps().find(a => a.name === "emulator") ?? initializeApp({ projectId }, "emulator")
    return { db: getFirestore(app), target: `emulator ${process.env.FIRESTORE_EMULATOR_HOST} (${projectId})` }
  }
  if (!allowProduction) throw new Error("No database chosen: set FIRESTORE_EMULATOR_HOST for the emulator, or pass --production to use production Firestore (never the default)")
  const { getDb } = await import("../../lib/firebase-admin")
  return { db: getDb(), target: "PRODUCTION Firestore (default database)" }
}

/**
 * The brand profile for a one-brand process (the replay harness): from a private file outside this repository (a
 * published version's 434-context backup record, or a bare profile), or read from the database (the emulator, or
 * production with allowProduction), and set for the process. Profiles are not in this public repository.
 */
export async function profileForProcess(id: string, opts: { file?: string; allowProduction?: boolean } = {}): Promise<ActiveProfile> {
  let active: ActiveProfile
  if (opts.file) {
    const raw = JSON.parse(readFileSync(opts.file, "utf8")) as { version_id?: string; profile?: unknown }
    const body = raw.profile ?? raw, profile = loadProfile(id, { [id]: body })
    active = { profile, versionId: typeof raw.version_id === "string" ? raw.version_id : `file:${profileSha256(body)}` }
  } else {
    const { requirePublishedProfile } = await import("../../lib/firestore-brand-profiles")
    active = await requirePublishedProfile(id, (await scriptDb(opts.allowProduction)).db)
  }
  setProcessProfile(active)
  return active
}
