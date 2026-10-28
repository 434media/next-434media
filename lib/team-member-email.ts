/**
 * The address a team member may carry (security log ADM-11). Members are created only on the workspace domain; an
 * edit is held to the same rule, so a PATCH cannot move a member to an outside address. Empty is allowed, as on
 * create. Returns the normalized address, or an error message.
 */
export const TEAM_MEMBER_EMAIL_DOMAIN = "434media.com"

export function normalizeTeamMemberEmail(email: unknown): { email: string } | { error: string } {
  if (email === undefined || email === null) return { email: "" }
  if (typeof email !== "string") return { error: "Email must be a string" }
  const trimmed = email.trim().toLowerCase()
  if (trimmed && !trimmed.endsWith(`@${TEAM_MEMBER_EMAIL_DOMAIN}`)) {
    return { error: `Email must be a @${TEAM_MEMBER_EMAIL_DOMAIN} address` }
  }
  return { email: trimmed }
}
