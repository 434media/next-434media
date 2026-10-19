import { before } from "node:test"
import { setProcessProfile, type ActiveProfile } from "../content-pipeline/brand"
import { loadProfile, type BrandProfile } from "../content-pipeline/profile"
import fixture from "./fixtures/brand-profile.fixture.json"

/**
 * The tests' brand profile, set for the process before a file's tests run (lib/content-pipeline/brand.ts):
 * - by default, the committed fixture (./fixtures/brand-profile.fixture.json): an INVENTED brand with made-up text and
 *   template ids, so the suites run anywhere, CI included, with no secret and no database;
 * - with BRAND_PROFILE_FILE, a private copy of a real profile outside this repository (a published version's backup);
 * - with FIRESTORE_EMULATOR_HOST, MilCityUSA's published profile read from the emulator.
 * Never production. The engine tests pass on any valid profile, so they read its values rather than restating them;
 * checks that only make sense for the real profile run only when `real` is true.
 */
export const published = {} as { active: ActiveProfile; milcity: BrandProfile; real: boolean }
export function loadPublishedProfileFirst(): void {
  before(async () => {
    const file = process.env.BRAND_PROFILE_FILE
    if (file || process.env.FIRESTORE_EMULATOR_HOST) {
      const { profileForProcess } = await import("../../scripts/brand-profiles/load")
      published.active = await profileForProcess("milcity", { file })
      published.real = true
    } else {
      published.active = { profile: loadProfile("milcity", { milcity: fixture.profile }), versionId: "fixture@v0" }
      setProcessProfile(published.active)
      published.real = false
    }
    published.milcity = published.active.profile
    console.log(`# brand profile: ${published.active.versionId} (${published.milcity.profileVersion}) from ${file ? "BRAND_PROFILE_FILE" : process.env.FIRESTORE_EMULATOR_HOST ? `the emulator at ${process.env.FIRESTORE_EMULATOR_HOST}` : "the committed fixture"}`)
  })
}
