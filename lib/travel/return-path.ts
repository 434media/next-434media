/**
 * Where a staff Google sign-in returns to (founder, 2026-11-19: "434 staff: sign in with Google" on the travel
 * sign-in page). The admin Google sign-in lands on /admin; started from a travel itinerary, it returns to that
 * itinerary instead.
 *
 * Allow-listed, never trusted: the only path accepted is a same-site itinerary path, `/travel/<project>/<traveler>`,
 * lowercase letters, digits and hyphens only, the same shape the travel sign-in page accepts. Anything else (an
 * absolute URL, `//host`, a backslash, percent-encoding, a query or fragment, a different path) is ignored and the
 * sign-in lands on /admin as before, so the return path can never become an open redirect.
 *
 * Pure, so the tests run offline (lib/__tests__/travel-return-path.test.ts).
 */

/** The itinerary path shape, with the project and traveler slugs captured. Shared with app/travel/sign-in. */
export const TRAVEL_ITINERARY_PATH = /^\/travel\/([a-z0-9-]+)\/([a-z0-9-]+)$/

/** The httpOnly cookie that carries the return path from the sign-in route to the callback, beside `oauth_state`. */
export const OAUTH_RETURN_COOKIE = "oauth_return_to"

/** Where the admin Google sign-in lands when there is no valid return path. */
export const ADMIN_LANDING = "/admin"

const MAX_LENGTH = 200

/** The return path if it is an itinerary path, otherwise null. */
export function safeTravelReturnPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > MAX_LENGTH) return null
  return TRAVEL_ITINERARY_PATH.test(value) ? value : null
}

/** Where the callback sends a signed-in admin: the stored itinerary path if it is still valid, otherwise /admin. */
export function postSignInPath(cookieValue: unknown): string {
  return safeTravelReturnPath(cookieValue) ?? ADMIN_LANDING
}
