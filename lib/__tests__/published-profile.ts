import { before } from "node:test"
import type { ActiveProfile } from "../content-pipeline/brand"
import type { BrandProfile } from "../content-pipeline/profile"

/**
 * The tests' brand profile: MilCityUSA's published profile, read from the database before the file's tests run, and
 * set for the process (lib/content-pipeline/brand.ts). Profiles are not in this public repository.
 *
 * Read from the Firestore emulator (FIRESTORE_EMULATOR_HOST, seeded with scripts/brand-profiles/profile.ts), or from
 * production Firestore with the app's credentials, or, on a machine with neither, from a private copy outside the
 * repository (BRAND_PROFILE_FILE: a published version's backup record). Each run prints which version it used.
 */
export const published = {} as { active: ActiveProfile; milcity: BrandProfile }
export function loadPublishedProfileFirst(): void {
  before(async () => {
    const { profileForProcess } = await import("../../scripts/brand-profiles/load")
    published.active = await profileForProcess("milcity", process.env.BRAND_PROFILE_FILE)
    published.milcity = published.active.profile
    console.log(`# brand profile: ${published.active.versionId} (${published.milcity.profileVersion}) from ${process.env.BRAND_PROFILE_FILE ? "BRAND_PROFILE_FILE" : process.env.FIRESTORE_EMULATOR_HOST ? `the emulator at ${process.env.FIRESTORE_EMULATOR_HOST}` : "production Firestore"}`)
  })
}
