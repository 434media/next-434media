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
