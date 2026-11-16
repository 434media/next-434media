/**
 * Load the made-up staging records (lib/staging/seed.ts) into c434-staging.
 *
 * The usual way is the preview route, /api/admin/staging/seed, which runs where staging's keyless access already
 * lives. This script is for the Firestore emulator, or for Cloud Shell signed in as the project's owner; it never
 * needs a key file.
 *
 *   tsx scripts/staging/seed.ts --project c434-staging --origin https://<preview-host>            # dry run: lists what it would write
 *   tsx scripts/staging/seed.ts --project c434-staging --origin https://<preview-host> --write    # writes
 *
 * Refuses any project but c434-staging, before it connects. With FIRESTORE_EMULATOR_HOST set it writes to the
 * emulator under that project id instead.
 */
import { initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"
import { assertStagingProject, buildStagingSeed, writeStagingSeed, type SeedDb } from "../../lib/staging/seed"

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main(): Promise<void> {
  const project = arg("project")
  assertStagingProject(project)
  const origin = arg("origin")
  if (!origin || !/^https?:\/\//.test(origin)) throw new Error("--origin is required: the preview the video post plays from, e.g. https://<preview-host>")

  const docs = buildStagingSeed({ origin })
  const byCollection = docs.reduce<Record<string, number>>((acc, d) => ({ ...acc, [d.collection]: (acc[d.collection] ?? 0) + 1 }), {})
  const target = process.env.FIRESTORE_EMULATOR_HOST ? `emulator ${process.env.FIRESTORE_EMULATOR_HOST}, project ${project}` : `project ${project}`
  console.log(`Staging seed for ${target}: ${JSON.stringify(byCollection)}`)
  if (!process.argv.includes("--write")) {
    console.log("Dry run. Add --write to write.")
    return
  }

  const db = getFirestore(initializeApp({ projectId: project }))
  const written = await writeStagingSeed(db as unknown as SeedDb, project, docs)
  console.log(`Wrote ${JSON.stringify(written)}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
