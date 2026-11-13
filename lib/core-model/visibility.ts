// Visibility (spec rule 3): every record states who may see it. Applied on every list and get, in the read layer
// (lib/core-model/read.ts), so every route, connector and agent read goes through the same check.
//
//   business    any signed-in admin (the default)
//   restricted  full admins only (crm_super_admin, full_admin)
//   private     the founder only: the address in ADMIN_FOUNDER_EMAIL, with a verified sign-in (lib/founder-guard.ts).
//               Not a role, because a role can be granted from inside the admin by someone who is not the founder.
//               A full admin, a super admin and every agent are refused, so a future employee who is a full admin
//               never sees the founder's personal contacts (spec, "Personal or business").
//
// `private` fails safe: a viewer whose founder flag is missing is not the founder.

import type { AdminRole } from "@/lib/session-cookie"
import type { Relationship, Visibility } from "@/types/core-model"
import { VISIBILITIES } from "@/types/core-model"

const FULL_ACCESS_ROLES: readonly AdminRole[] = ["crm_super_admin", "full_admin"]

export interface VisibilityViewer {
  role?: AdminRole | null
  superAdmin?: boolean
  /** True only when founderDecision (lib/founder-guard.ts) allowed this session. */
  founder?: boolean
}

/** Unknown or missing values read as `business`. */
export function normalizeVisibility(value: unknown): Visibility {
  return VISIBILITIES.includes(value as Visibility) ? (value as Visibility) : "business"
}

/** Unknown or missing values read as `business`, the relationship every record had before personal contacts. */
export function normalizeRelationship(value: unknown): Relationship {
  return value === "personal" ? "personal" : "business"
}

function isFullAdmin(viewer: VisibilityViewer): boolean {
  return Boolean(viewer.superAdmin) || FULL_ACCESS_ROLES.includes((viewer.role ?? "crm_only") as AdminRole)
}

/**
 * The visibility a record actually has. A personal record is `private` whatever its stored visibility says, so a
 * mistake in one field can only hide a record, never show it.
 */
export function effectiveVisibility(record: { visibility?: unknown; relationship?: unknown }): Visibility {
  if (normalizeRelationship(record.relationship) === "personal") return "private"
  return normalizeVisibility(record.visibility)
}

/** Whether a viewer may see a record. */
export function canSee(record: { visibility?: unknown; relationship?: unknown }, viewer: VisibilityViewer): boolean {
  const v = effectiveVisibility(record)
  if (v === "business") return true
  if (v === "private") return viewer.founder === true
  return viewer.founder === true || isFullAdmin(viewer)
}

/** Whether a viewer may set `visibility` to this value (and change it away from what it was). */
export function canSetVisibility(viewer: VisibilityViewer, to: Visibility = "restricted"): boolean {
  if (to === "private") return viewer.founder === true
  return viewer.founder === true || isFullAdmin(viewer)
}

/** Only the founder adds, sees or decides personal contacts. Staff adds are always `business`. */
export function canHandlePersonal(viewer: VisibilityViewer): boolean {
  return viewer.founder === true
}

export function visibleOnly<T extends { visibility?: unknown; relationship?: unknown }>(records: T[], viewer: VisibilityViewer): T[] {
  return records.filter((r) => canSee(r, viewer))
}

/**
 * What an agent (Polí, the connector) may do with a Person. A personal contact may be read only to suggest that it
 * become business, which the founder decides; it is never contacted, edited or shared (spec, "Personal or
 * business"; contract 1.5 §2). Everything else follows the Person's visibility for the person the agent acts for.
 */
export type AgentPurpose = "suggest_promotion" | "read" | "contact" | "edit" | "share"

export function agentMayUse(
  person: { visibility?: unknown; relationship?: unknown },
  purpose: AgentPurpose,
  actingFor: VisibilityViewer,
): boolean {
  if (normalizeRelationship(person.relationship) === "personal") {
    return purpose === "suggest_promotion" && actingFor.founder === true
  }
  return canSee(person, actingFor)
}
