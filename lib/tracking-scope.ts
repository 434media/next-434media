/**
 * Routes no third-party tracker loads on: internal tooling (/admin), travellers'
 * private itineraries (/travel) and the full-screen deck (/squads). Read by
 * components/MetaPixel.tsx and components/PublicTrackers.tsx, so the list is
 * kept in one place.
 */
export const UNTRACKED_PREFIXES = ["/admin", "/travel", "/squads"] as const

export function isTrackedPath(pathname: string | null): boolean {
  if (!pathname) return true
  return !UNTRACKED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))
}
