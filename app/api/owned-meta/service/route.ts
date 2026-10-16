import { authorizeAdminSignIn, canSend, isCrmSuperAdmin } from "@/lib/auth"
import { remoteJwks } from "@/lib/owned-meta-oauth"
import { handleServiceRequest, loadServiceConfig } from "@/lib/owned-meta-service"
import { runOwnedMetaTool } from "@/lib/owned-meta-tool-handler"
import { ownedMetaConnectorDeps } from "@/lib/owned-meta-execution"

export const runtime = "nodejs"
export const maxDuration = 300 // Canva export polling plus up to ten staged pages

/**
 * MCU publisher entry for the shared Slack app (pilot project), authenticated by the pilot's Vercel OIDC identity
 * and, separately, by the acting person's permissions here. See lib/owned-meta-service.ts. Production only.
 */
let jwks: { url: string; get: ReturnType<typeof remoteJwks> } | null = null
export async function POST(req: Request) {
  if (process.env.VERCEL_ENV !== "production") return Response.json({ error: "Previews cannot use the publisher service" }, { status: 423 })
  const { config, problems } = loadServiceConfig(process.env)
  if (!config) { console.error("[owned-meta-service] not configured:", problems.join(",")); return Response.json({ error: "Publisher service is not configured" }, { status: 503 }) }
  const url = `${config.issuer}/.well-known/jwks`
  if (!jwks || jwks.url !== url) jwks = { url, get: remoteJwks(url) }
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer /, "") || undefined
  let body: unknown
  try { body = await req.json() } catch { return Response.json({ error: "Invalid request" }, { status: 400 }) }
  const r = await handleServiceRequest(bearer, body, {
    config, jwks: jwks.get, nowSeconds: () => Math.floor(Date.now() / 1000),
    authorize: email => authorizeAdminSignIn(email, "google"),
    sendCapable: async (email, role) => canSend(role) || await isCrmSuperAdmin(email),
    approvers: process.env.OWNED_META_APPROVER_SLACK_IDS,
    toolDeps: ownedMetaConnectorDeps,
    run: runOwnedMetaTool,
    onRefuse: reason => console.warn("[owned-meta-service] refused:", reason),
  })
  return Response.json(r.body, { status: r.status, headers: { "cache-control": "no-store" } })
}
