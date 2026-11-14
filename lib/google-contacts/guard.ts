import { NextResponse } from "next/server"
import { isCrmSuperAdmin, type User } from "@/lib/auth"
import { requireFounder } from "@/lib/founder-guard"

/**
 * The gate for every Google Contacts route. The address book is the founder's personal Gmail (interface contract
 * 1.5 §2), so this is the founder guard (ADMIN_FOUNDER_EMAIL with a verified sign-in, lib/founder-guard.ts) **and**
 * a super admin on the roster or in ADMIN_OWNER_EMAILS: a super admin who is not the founder is refused, and so is
 * the founder's address if it ever lost super-admin standing. No role in the admin can grant this.
 */
export async function requireContactsOwner(where: string): Promise<{ session: User } | { response: NextResponse }> {
  const auth = await requireFounder(where)
  const noStore = { "cache-control": "private, no-store" }
  if ("error" in auth) return { response: NextResponse.json({ error: auth.error }, { status: auth.status, headers: noStore }) }
  if (!(await isCrmSuperAdmin(auth.session.email))) {
    console.warn(`[google-contacts] ${where}: founder address without super admin; denied`)
    return { response: NextResponse.json({ error: "Forbidden: founder only" }, { status: 403, headers: noStore }) }
  }
  return { session: auth.session }
}

/** Same origin only for a state-changing call: SameSite=Lax would still carry the cookie from a sibling subdomain. */
export function crossOriginRefusal(req: Request, origin: string): NextResponse | null {
  return req.headers.get("origin") === origin ? null : NextResponse.json({ error: "Cross-origin request refused" }, { status: 403 })
}
