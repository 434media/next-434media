// Visibility (spec rule 3): every record states who may see it. `business`, the default, is any signed-in
// admin; `restricted` is full admins only (crm_super_admin, full_admin). Applied on every list and get.

import type { AdminRole } from "@/lib/session-cookie"
import type { Visibility } from "@/types/core-model"
import { VISIBILITIES } from "@/types/core-model"

const FULL_ACCESS_ROLES: readonly AdminRole[] = ["crm_super_admin", "full_admin"]

/** Unknown or missing values read as `business`. */
export function normalizeVisibility(value: unknown): Visibility {
  return VISIBILITIES.includes(value as Visibility) ? (value as Visibility) : "business"
}

/** Whether a viewer with this role (or roster super-admin flag) may see a record. */
export function canSee(record: { visibility?: unknown }, viewer: { role?: AdminRole | null; superAdmin?: boolean }): boolean {
  if (normalizeVisibility(record.visibility) === "business") return true
  return Boolean(viewer.superAdmin) || FULL_ACCESS_ROLES.includes((viewer.role ?? "crm_only") as AdminRole)
}

/** Whether a viewer may set or change visibility (only full admins may restrict or unrestrict). */
export function canSetVisibility(viewer: { role?: AdminRole | null; superAdmin?: boolean }): boolean {
  return Boolean(viewer.superAdmin) || FULL_ACCESS_ROLES.includes((viewer.role ?? "crm_only") as AdminRole)
}

export function visibleOnly<T extends { visibility?: unknown }>(
  records: T[],
  viewer: { role?: AdminRole | null; superAdmin?: boolean },
): T[] {
  return records.filter((r) => canSee(r, viewer))
}
