/**
 * Per-person permissions for the 434 connector (434 build sequence V1 item 4, "the connector, widened": "per-person
 * permissions"; founder approval of slice 1, 2026-11-17).
 *
 * No new store. A person's skills are entries in the roster's existing `crm_team_members.permissions` array, beside
 * the "content" permission already there (lib/auth.ts CONTENT_PERMISSION): `skill:<name>`, where `<name>` is a skill in
 * the catalog (434-context `03 Skills/skills-index.json`). The roster is read on every call, so removing an entry or
 * deactivating the person takes effect on their next call.
 *
 * Least privilege: an entry naming a skill the catalog does not hold grants nothing, and no entry grants another. An
 * owner or an active super admin holds every catalog skill, as they hold "content" (lib/auth.ts rosterCanRunContent).
 *
 * Pure apart from `readRosterRecord`.
 */
import type { RosterRecord } from "../auth"

export const SKILL_PERMISSION_PREFIX = "skill:"
const SKILL_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** The permission string for one skill. Refuses a name that is not a catalog-style skill name. */
export function skillPermission(skill: string): string {
  if (!SKILL_NAME.test(skill)) throw new Error(`not a skill name: ${skill}`)
  return `${SKILL_PERMISSION_PREFIX}${skill}`
}

/**
 * The catalog skills one person may run through the connector. `record` is their roster record (null when there is
 * none); `owner` says whether the address is a project owner (lib/auth.ts isOwnerEmail). Sorted, no duplicates.
 */
export function permittedSkills(record: RosterRecord | null, catalog: readonly string[], owner = false): string[] {
  const known = [...new Set(catalog.filter((s) => SKILL_NAME.test(s)))].sort()
  if (owner) return known
  if (!record || record.isActive === false) return []
  if (record.role === "crm_super_admin") return known
  if (!Array.isArray(record.permissions)) return []
  const granted = new Set(
    record.permissions
      .filter((p): p is string => typeof p === "string" && p.startsWith(SKILL_PERMISSION_PREFIX))
      .map((p) => p.slice(SKILL_PERMISSION_PREFIX.length)),
  )
  return known.filter((s) => granted.has(s))
}

/** One roster read by address. A failed or empty lookup returns null, which grants nothing. */
export async function readRosterRecord(email: string): Promise<RosterRecord | null> {
  try {
    const { getDb } = await import("../firebase-admin")
    const snap = await getDb().collection("crm_team_members").where("email", "==", email.toLowerCase()).limit(2).get()
    // Two records for one address is the sign-in gate's `duplicate_roster_records`: grant nothing.
    return snap.size === 1 ? (snap.docs[0].data() as RosterRecord) : null
  } catch (error) {
    console.error("[connector-434] roster lookup failed; no skills granted:", error)
    return null
  }
}
