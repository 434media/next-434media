import type { AdminRole } from "../session-cookie"

/**
 * Which admin roles reach every travel itinerary without a per-trip record (security log PSM-2; founder's ruling,
 * 2026-11-10: "Approve option 1"). A traveller's page is a named person's movements, so least privilege applies: super
 * admins (owners are always `crm_super_admin`) and full admins only. A `crm_only` or `intern` session gets no staff
 * access. It reaches an itinerary only through a `travel_access` record for that page, signed in on the travel portal,
 * like anyone else.
 *
 * Kept free of runtime imports so the rule is tested offline.
 */
export const STAFF_TRAVEL_ROLES: readonly AdminRole[] = ["crm_super_admin", "full_admin"]

/** True when an admin session's role reads every itinerary as staff. Unknown or missing roles are refused. */
export function staffReadsItineraries(role: AdminRole | string | null | undefined): boolean {
  return typeof role === "string" && (STAFF_TRAVEL_ROLES as readonly string[]).includes(role)
}
