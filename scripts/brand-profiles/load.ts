import { readFileSync } from "node:fs"
import { loadProfile } from "../../lib/content-pipeline/profile"
import { profileSha256 } from "../../lib/content-pipeline/profile-store"
import { setProcessProfile, type ActiveProfile } from "../../lib/content-pipeline/brand"

/**
 * The brand profile for a one-brand process (the replay harness, the offline tests): read from the database, or from
 * a private file outside this repository (a published version's 434-context backup record, or a bare profile), and
 * set for the process. Profiles are not in this public repository.
 *
 * Without a file this reads Firestore, so it needs Firebase credentials; set FIRESTORE_EMULATOR_HOST to read the
 * emulator instead of production.
 */
/**
 * The database a script reads and writes. With FIRESTORE_EMULATOR_HOST set it is the emulator, under a "demo-" project
 * id, which the Firebase SDKs never send to Google, and the production key is not loaded at all. Otherwise it is the
 * production database through the app's own credentials (GOOGLE_SERVICE_ACCOUNT_KEY).
 */
export async function scriptDb(): Promise<{ db: FirebaseFirestore.Firestore; target: string }> {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    const [{ initializeApp, getApps }, { getFirestore }] = await Promise.all([import("firebase-admin/app"), import("firebase-admin/firestore")])
    const projectId = process.env.EMULATOR_PROJECT_ID ?? "demo-434-brand-profiles"
    if (!projectId.startsWith("demo-")) throw new Error("EMULATOR_PROJECT_ID must start with demo- so nothing can reach a real project")
    const app = getApps().find(a => a.name === "emulator") ?? initializeApp({ projectId }, "emulator")
    return { db: getFirestore(app), target: `emulator ${process.env.FIRESTORE_EMULATOR_HOST} (${projectId})` }
  }
  const { getDb } = await import("../../lib/firebase-admin")
  return { db: getDb(), target: "PRODUCTION Firestore (default database)" }
}

export async function profileForProcess(id: string, file?: string): Promise<ActiveProfile> {
  let active: ActiveProfile
  if (file) {
    const raw = JSON.parse(readFileSync(file, "utf8")) as { version_id?: string; profile?: unknown }
    const body = raw.profile ?? raw, profile = loadProfile(id, { [id]: body })
    active = { profile, versionId: typeof raw.version_id === "string" ? raw.version_id : `file:${profileSha256(body)}` }
  } else {
    const { requirePublishedProfile } = await import("../../lib/firestore-brand-profiles")
    active = await requirePublishedProfile(id, (await scriptDb()).db)
  }
  setProcessProfile(active)
  return active
}
