/**
 * Seed/refresh the starred Week-1 deliverables on a cohort board. Week 1 is
 * FOUNDATIONAL — research & fundamentals, since the interns are students, not
 * domain experts. Operators own these starred deliverables; interns add the rest.
 *
 * Declarative reconcile per squad: creates missing deliverables, updates changed
 * descriptions, and removes stale operator-seeded ones (week 1, starred,
 * created_by "434 Media") that are no longer listed — so re-running after editing
 * this file converges the board with no duplicates.
 *
 *   npx tsx --env-file=.env.local scripts/seed-week1-deliverables.ts [cohortId]
 */
import {
  getCohorts,
  getCohortTasksByCohort,
  createCohortTask,
  updateCohortTask,
  deleteCohortTask,
} from "../lib/firestore-crm"
import { SQUAD_LABELS, type SquadKey } from "../components/crm/types"

const SEED_AUTHOR = "434 Media"

// Most squads get one foundational deliverable; Storytellers (3 people) gets one
// per partner so each person owns a brand review.
const DELIVERABLES: Record<SquadKey, Array<{ title: string; description: string }>> = {
  gtm: [
    {
      title: "Learn outbound sales & Apollo basics",
      description:
        "Read Apollo's outbound-sales guide. In your own words, write up what an ICP (ideal customer profile) is and how prospecting works, then explore Leads → Prospect. See SOPs → Digital Canvas → Find.",
    },
  ],
  domain: [
    {
      title: "Research how we source real-world problems",
      description:
        "Study PAINstorming (Praxie / Soren Kaplan), Monday.com intake-form design, and Bundl value spaces. Capture what makes a problem 'venture-credible' and start the Underwriter Intake Framework doc. See SOPs → Digital Canvas → Frame.",
    },
  ],
  build: [
    {
      title: "Git foundations: clone, branch, commit, push, open a PR",
      description:
        "Clone the next-canvas repo, create a branch, make a commit, push it, then open a pull request for review. Get comfortable with the full loop. See SOPs → Digital Canvas → Ship.",
    },
  ],
  story_media: [
    {
      title: "Review 434 Media's brand, tone & visual style",
      description:
        "Study the 434 Media work page (https://www.434media.com/work). Capture tone, messaging, and visual style — and how it connects to Digital Canvas. See SOPs → Digital Canvas → Tell.",
    },
    {
      title: "Review DevSA's brand, tone & visual style",
      description:
        "Study DevSA on Instagram (https://www.instagram.com/devsatx/). Capture tone, messaging, and visual style — and how it connects to Digital Canvas. See SOPs → Digital Canvas → Tell.",
    },
    {
      title: "Review Alamo Angels' brand, tone & visual style",
      description:
        "Study Alamo Angels on Instagram (https://www.instagram.com/alamoangelsofsa/). Capture tone, messaging, and visual style — and how it connects to Digital Canvas. See SOPs → Digital Canvas → Tell.",
    },
  ],
  analytics: [
    {
      title: "Research how top accelerators measure cohort health",
      description:
        "Study Y Combinator (momentum & traction; Rahul Vohra's PMF engine) and Techstars (Founder NPS, program quality). Start the Cohort Health Framework doc. See SOPs → Digital Canvas → Prove.",
    },
  ],
}

// Reconcile order = pipeline order (Find → Frame → Ship → Tell → Prove).
const SQUAD_ORDER: SquadKey[] = ["gtm", "domain", "build", "story_media", "analytics"]

async function main() {
  const argCohortId = process.argv[2]
  const cohorts = await getCohorts({ fresh: true })

  if (cohorts.length === 0) {
    console.error("✗ No cohorts exist yet. Create one in /admin/cohorts first (operator-only), then re-run.")
    process.exit(1)
  }

  const cohort = argCohortId
    ? cohorts.find((c) => c.id === argCohortId)
    : cohorts.length === 1
      ? cohorts[0]
      : undefined
  if (!cohort) {
    console.error(
      argCohortId
        ? `✗ Cohort ${argCohortId} not found.`
        : `✗ Multiple cohorts — pass a cohortId:\n${cohorts.map((c) => `    ${c.id}  ${c.name}`).join("\n")}`,
    )
    process.exit(1)
  }

  const existing = await getCohortTasksByCohort(cohort.id)
  let created = 0
  let updated = 0
  let unchanged = 0
  let removed = 0

  for (const squad of SQUAD_ORDER) {
    const desired = DELIVERABLES[squad]
    const desiredTitles = new Set(desired.map((d) => d.title))
    const seeded = existing.filter(
      (t) => t.squad === squad && t.week === 1 && t.isDeliverable && t.created_by === SEED_AUTHOR,
    )

    // Remove operator-seeded deliverables that are no longer listed.
    for (const t of seeded) {
      if (!desiredTitles.has(t.title)) {
        await deleteCohortTask(t.id)
        console.log(`🗑  removed [${SQUAD_LABELS[squad]}] ${t.title}`)
        removed++
      }
    }

    // Create / update the desired deliverables.
    for (const d of desired) {
      const match = seeded.find((t) => t.title === d.title)
      if (match) {
        if (match.description !== d.description) {
          await updateCohortTask(match.id, { description: d.description })
          console.log(`↻ updated [${SQUAD_LABELS[squad]}] ${d.title}`)
          updated++
        } else {
          unchanged++
        }
        continue
      }
      const task = await createCohortTask({
        cohortId: cohort.id,
        squad,
        title: d.title,
        description: d.description,
        status: "not_started",
        week: 1,
        isDeliverable: true,
        created_by: SEED_AUTHOR,
      })
      console.log(`✅ [${SQUAD_LABELS[squad]}] ${d.title} — id: ${task.id}`)
      created++
    }
  }

  console.log(
    `\nDone on "${cohort.name}" — ${created} created, ${updated} updated, ${unchanged} unchanged, ${removed} removed.`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
