import { NextResponse, type NextRequest } from "next/server"
import { cookies } from "next/headers"
import { createHash, randomBytes } from "node:crypto"
import { getSession, isAuthorizedAdmin, isCrmSuperAdmin } from "@/lib/auth"
import { canvaTokenStore } from "@/lib/firestore-crm"
import { createCanvaClient, CANVA_AUTHORIZE_URL, CANVA_EXPORT_SCOPES } from "@/lib/canva-connect"

// GET /api/admin/integrations/canva            → status (connected, scope, expiry; no token material)
// GET /api/admin/integrations/canva?start=1    → redirect the super admin to Canva's consent screen (PKCE)
// GET /api/admin/integrations/canva?code=…     → Canva's redirect back; exchanges the code and stores the
//                                                rotated refresh token in crm_meta/canva_connection.
//
// This is the one human step the server-side export needs: the founder grants
// `design:content:read` once. The Developer Portal app's client id/secret are
// configuration (CANVA_CLIENT_ID / CANVA_CLIENT_SECRET); this route creates no
// credential and never returns one.
export const runtime = "nodejs"
const COOKIE = "canva_oauth_pkce"

function redirectUri(req: NextRequest) { return `${process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin}/api/admin/integrations/canva` }
function client() {
  const clientId = process.env.CANVA_CLIENT_ID, clientSecret = process.env.CANVA_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  return createCanvaClient({ clientId, clientSecret, store: canvaTokenStore() })
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAuthorizedAdmin(session.email) || !await isCrmSuperAdmin(session.email)) return NextResponse.json({ error: "Super admin required" }, { status: 403 })
  const canva = client()
  const params = req.nextUrl.searchParams
  if (!canva) return NextResponse.json({ configured: false, connected: false, note: "Set CANVA_CLIENT_ID and CANVA_CLIENT_SECRET on the Vercel project first" }, { status: 503 })

  if (params.get("start") === "1") {
    const verifier = randomBytes(48).toString("base64url"), state = randomBytes(16).toString("base64url")
    const challenge = createHash("sha256").update(verifier).digest("base64url")
    const jar = await cookies()
    jar.set(COOKIE, JSON.stringify({ verifier, state }), { httpOnly: true, secure: true, sameSite: "lax", path: "/api/admin/integrations/canva", maxAge: 600 })
    const url = new URL(CANVA_AUTHORIZE_URL)
    url.searchParams.set("code_challenge", challenge); url.searchParams.set("code_challenge_method", "s256")
    url.searchParams.set("scope", CANVA_EXPORT_SCOPES.join(" ")); url.searchParams.set("response_type", "code")
    url.searchParams.set("client_id", process.env.CANVA_CLIENT_ID!); url.searchParams.set("redirect_uri", redirectUri(req)); url.searchParams.set("state", state)
    return NextResponse.redirect(url)
  }

  const code = params.get("code")
  if (code) {
    const jar = await cookies()
    let pkce: { verifier?: string; state?: string } = {}
    try { pkce = JSON.parse(jar.get(COOKIE)?.value || "{}") } catch { pkce = {} }
    jar.delete(COOKIE)
    if (!pkce.verifier || !pkce.state || pkce.state !== params.get("state")) return NextResponse.json({ error: "Consent state mismatch; start the connection again" }, { status: 400 })
    try { await canva.exchangeCode(code, pkce.verifier, redirectUri(req)) } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Canva exchange failed" }, { status: 502 }) }
    return NextResponse.json({ ...(await canva.health()), justConnected: true })
  }
  return NextResponse.json({ configured: true, ...(await canva.health()) })
}
