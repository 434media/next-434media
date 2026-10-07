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

/**
 * Set by proxy.ts for visitors allowed to receive the Meta Pixel; read by
 * components/MetaPixel.tsx. The decision itself is lib/meta-pixel-gate.ts,
 * which is server-only because it reads the exclusion list.
 */
export const META_PIXEL_COOKIE = "434_px"
