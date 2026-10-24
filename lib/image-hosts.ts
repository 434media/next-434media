/**
 * The remote image hosts next/image may optimize. next.config.ts builds
 * `images.remotePatterns` from this list, and `isOptimizableImage` reads the
 * same list, so a component can tell in advance whether next/image will accept
 * a URL. next/image throws on a host that is not listed, which on a page that
 * renders authored URLs (The Feed) would take the whole page down.
 *
 * Pure module: next.config.ts imports it, so no aliases and no server imports.
 */
export const REMOTE_IMAGE_PATTERNS = [
  { protocol: "https", hostname: "storage.googleapis.com", pathname: "/groovy-ego-462522-v2.firebasestorage.app/**" },
  // Same bucket through the Firebase download API. The Lead with Ops flyer is
  // served from here (moved from the Digital Canvas site, 2026-10).
  { protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: "/v0/b/groovy-ego-462522-v2.firebasestorage.app/**" },
  { protocol: "https", hostname: "cdn.shopify.com", pathname: "/s/files/**" },
  { protocol: "https", hostname: "placehold.co", pathname: "/**" },
  { protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/**" },
  { protocol: "https", hostname: "img.youtube.com", pathname: "/**" },
] as const

function hostMatches(pattern: string, hostname: string): boolean {
  // next/image semantics: "*" is one subdomain label, "**" any number.
  if (pattern.startsWith("**.")) return hostname.endsWith(pattern.slice(2))
  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(1)
    return hostname.endsWith(suffix) && !hostname.slice(0, -suffix.length).includes(".")
  }
  return hostname === pattern
}

function pathMatches(pattern: string, pathname: string): boolean {
  if (pattern.endsWith("/**")) return pathname.startsWith(pattern.slice(0, -2))
  return pathname === pattern
}

/** True when next/image will optimize `src`; false for anything else, including relative or malformed URLs. */
export function isOptimizableImage(src: string): boolean {
  let url: URL
  try {
    url = new URL(src)
  } catch {
    return false
  }
  return REMOTE_IMAGE_PATTERNS.some(
    (p) => url.protocol === `${p.protocol}:` && hostMatches(p.hostname, url.hostname) && pathMatches(p.pathname, url.pathname),
  )
}
