import { AsyncLocalStorage } from "node:async_hooks"
import type { BrandProfile } from "./profile"

/**
 * The brand profile the engine runs. Profiles live in Firestore (lib/firestore-brand-profiles.ts, `brand_profiles`),
 * not in this repository: every entry point reads the brand's published profile from the database and runs the engine
 * inside withProfile(), so the copy path never runs on a cached or bundled copy of the rules. BRAND and the values
 * derived from it (SERIES, KIND_CODE, …) are live views of the profile in scope; reading one outside a scope throws,
 * so nothing can quietly run on a stale or missing profile.
 *
 * Scripts and tests that are one process for one brand (the replay harness, the offline tests) read the profile from
 * the database once and set it for the process with setProcessProfile; a request handler never does.
 */
export interface ActiveProfile {
  profile: BrandProfile
  /** The published version's id ("milcity@v1"), stamped on every post written under it (profile_version_id). */
  versionId: string
}

const scope = new AsyncLocalStorage<ActiveProfile>()
let processProfile: ActiveProfile | null = null

export function withProfile<T>(active: ActiveProfile, fn: () => T): T {
  return scope.run(active, fn)
}
export function setProcessProfile(active: ActiveProfile | null): void {
  processProfile = active
}
export function activeProfile(): ActiveProfile {
  const active = scope.getStore() ?? processProfile
  if (!active) throw new Error("No published brand profile is in scope: read it from the database (lib/firestore-brand-profiles.ts) and run inside withProfile()")
  return active
}

/** A read-only view of an object computed from the profile in scope, evaluated on every access. */
export function live<T extends object>(get: () => T): T {
  return new Proxy({} as T, {
    get: (_, k) => Reflect.get(get(), k),
    has: (_, k) => Reflect.has(get(), k),
    ownKeys: () => Reflect.ownKeys(get()),
    getOwnPropertyDescriptor: (_, k) => {
      const d = Reflect.getOwnPropertyDescriptor(get(), k)
      return d && { ...d, configurable: true }
    },
    set: () => false,
    deleteProperty: () => false,
  })
}

export const BRAND: BrandProfile = live(() => activeProfile().profile)
