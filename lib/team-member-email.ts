/**
 * The address a team member may carry (security log ADM-11). Members are created only on the workspace domain; an
 * edit is held to the same rule, so a PATCH cannot move a member to an outside address. Empty is allowed on create;
 * an edit passes `required`, since clearing the address locks its owner out. Returns the normalized address, or an
 * error message.
 */
export const TEAM_MEMBER_EMAIL_DOMAIN = "434media.com"

export function normalizeTeamMemberEmail(
  email: unknown,
  opts: { required?: boolean } = {},
): { email: string } | { error: string } {
  if (email !== undefined && email !== null && typeof email !== "string") return { error: "Email must be a string" }
  const trimmed = typeof email === "string" ? email.trim().toLowerCase() : ""
  // An edit may not clear the address: the record would no longer match its owner, who could not sign in.
  if (opts.required && !trimmed) return { error: "Email cannot be empty" }
  if (trimmed && !trimmed.endsWith(`@${TEAM_MEMBER_EMAIL_DOMAIN}`)) {
    return { error: `Email must be a @${TEAM_MEMBER_EMAIL_DOMAIN} address` }
  }
  return { email: trimmed }
}
