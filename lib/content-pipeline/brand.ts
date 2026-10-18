import { DEFAULT_PROPERTY } from "./properties"
import { loadProfile } from "./profile"

/**
 * The brand profile the engine runs: today MilCityUSA's, the only property with a profile. Loading it validates it, so
 * a profile that fails validation stops the pipeline here rather than running on a half-read catalog. When a second
 * property has a profile, a job's property chooses its profile instead of this default.
 */
export const BRAND = loadProfile(DEFAULT_PROPERTY)
