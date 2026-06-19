/**
 * Backfill `slug` on any cohort created before slugs existed, so its detail URL
 * reads /admin/cohorts/<slug> instead of the doc id. Idempotent — skips cohorts
 * that already have a slug.
 *
 *   npx tsx --env-file=.env.local scripts/backfill-cohort-slugs.ts
 */
import { getCohorts, updateCohort } from "../lib/firestore-crm"

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "cohort"
  )
}

async function main() {
  const cohorts = await getCohorts({ fresh: true })
  const taken = new Set(cohorts.map((c) => c.slug).filter(Boolean) as string[])
  let n = 0
  for (const c of cohorts) {
    if (c.slug) {
      console.log(`✓ ${c.name} already has slug "${c.slug}"`)
      continue
    }
    const base = slugify(c.name)
    let slug = base
    let i = 2
    while (taken.has(slug)) slug = `${base}-${i++}`
    taken.add(slug)
    await updateCohort(c.id, { slug })
    console.log(`✅ ${c.name} → ${slug}`)
    n++
  }
  console.log(`\nDone — ${n} backfilled.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
