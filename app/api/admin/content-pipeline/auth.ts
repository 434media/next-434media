import { getSession, isAuthorizedAdmin, isCrmSuperAdmin } from "@/lib/auth"

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
