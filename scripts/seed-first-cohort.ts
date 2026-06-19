/**
 * Create the first Digital Canvas cohort — "434 Media", vertical Sales & Media —
 * if it doesn't already exist. Idempotent (matches by name). After this, run
 * seed-week1-deliverables.ts to populate the board.
 *
 *   npx tsx --env-file=.env.local scripts/seed-first-cohort.ts
 */
import { getCohorts, createCohort } from "../lib/firestore-crm"

const NAME = "434 Media"

async function main() {
  const cohorts = await getCohorts({ fresh: true })
  const existing = cohorts.find((c) => c.name === NAME)
  if (existing) {
    console.log(`✓ Cohort "${NAME}" already exists — id: ${existing.id}`)
    return
  }
  const cohort = await createCohort({
    name: NAME,
    vertical: "sales_media",
    hostBrand: "434 Media",
    status: "active",
    created_by: "434 Media",
  })
  console.log(`✅ Created cohort "${cohort.name}" (Sales & Media) — id: ${cohort.id}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
