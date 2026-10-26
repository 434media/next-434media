import { canRunContent, getSession, isAuthorizedAdmin, isCrmSuperAdmin } from "@/lib/auth"

/**
 * The admin gate (admin-api-route skill), plus super-admin: a Generate run spends model and Canva credit and writes
 * drafts to the board, so it starts with the same people who review them (the board's approve/reject gate).
 */
export async function requireSuperAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) return { error: "Forbidden: Admin access required", status: 403 as const }
  if (!await isCrmSuperAdmin(session.email)) return { error: "Forbidden: super-admin access required", status: 403 as const }
  return { session }
}

/**
 * The admin gate plus the content permission (lib/auth.ts canRunContent): the Create table's routes, which spend model
 * and Canva credit and land posts in Review, open to super-admins and to the team members who run content.
 */
export async function requireContentRunner() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) return { error: "Forbidden: Admin access required", status: 403 as const }
  if (!await canRunContent(session.email)) return { error: "Forbidden: the content permission is required", status: 403 as const }
  return { session }
}

/**
 * The admin gate for 434 staff: any admin except an intern (interns are the self-registered cohort, not staff), as the
 * brand book at /admin/brand is gated. `superAdmin` says whether the caller may also edit and publish (the Brands area
 * shows staff the brand book, and super-admins the rest).
 */
export async function requireStaff() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email) || session.role === "intern") return { error: "Forbidden: 434 staff only", status: 403 as const }
  return { session, superAdmin: await isCrmSuperAdmin(session.email) }
}
