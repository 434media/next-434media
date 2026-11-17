/**
 * The 434 connector — the one way in for every assistant (434 build sequence V1 item 4, "the connector, widened";
 * R1; slice 1 approved by the founder 2026-11-17).
 *
 * Sign-in reuses the publisher connector's Auth0 check (lib/owned-meta-oauth.ts verifyConnectorToken) with this
 * connector's own audience, client and caller map (`CONNECTOR_434_*`) and its own scope, `434:connect`: an RS256 token
 * checked on every call, mapped to a person by its exact subject, then the admin roster gate. Unlike the publisher, any
 * active roster role may connect; what a person may run is decided per tool (lib/connector-434/tools.ts,
 * lib/connector-434/permissions.ts). Deactivating someone on the roster refuses them on their next call. Tokens are
 * short-lived: the Auth0 API's access-token lifetime is set to one hour at go-live.
 *
 * The MCP server is built per request, after the token is checked, so each person's tool list holds only their tools.
 *
 * Ships switched off. It refuses every call outside Production, and in Production until its `CONNECTOR_434_*`
 * settings exist. Those are set only after agent hardening SEC-1 to SEC-5 closes (build sequence item 4).
 */
import type { AuthInfo } from "@modelcontextprotocol/server"
import { createMcpHandler, withMcpAuth } from "mcp-handler"
import { authorizeAdminSignIn } from "@/lib/auth"
import { loadConnectorConfig, remoteJwks, verifyConnectorToken } from "@/lib/owned-meta-oauth"
import { getOne } from "@/lib/sor/read"
import { BRAND_VOICE_KEY, brandVoiceOf, build434Context, contextProblems } from "@/lib/connector-434/context"
import { CONNECTOR_434_ENV_PREFIX, CONNECTOR_434_SCOPE, CONTEXT_TOOL, callerOf, toolsFor, type Caller434 } from "@/lib/connector-434/tools"

export const runtime = "nodejs"
export const maxDuration = 30

const text = (value: unknown, isError = false) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  ...(isError ? { isError: true } : {}),
})

async function contextTool(caller: Caller434) {
  let voice = null
  try {
    // The voice file is stored with the policy documents, an internal collection; only this one row is read, and it
    // passes the content check before it leaves.
    voice = brandVoiceOf((await getOne("policy_documents", BRAND_VOICE_KEY, "internal")).data)
  } catch (error) {
    console.error("[connector-434] brand voice read failed; serving without it:", error)
  }
  const context = build434Context(voice)
  const problems = contextProblems(context)
  if (problems.length) {
    console.error("[connector-434] context refused:", problems.join("; "))
    return text({ error: "The 434 context failed its content check and was not sent." }, true)
  }
  console.info("[connector-434] call", JSON.stringify({ tool: CONTEXT_TOOL.name, role: caller.role }))
  return text(context)
}

/** One MCP server for one caller, holding only that caller's tools. */
function serverFor(caller: Caller434) {
  return createMcpHandler((server) => {
    for (const tool of toolsFor(caller)) {
      if (tool.name !== CONTEXT_TOOL.name) continue // slice 2 registers skill tools here
      server.registerTool(tool.name, {
        title: tool.title,
        description: tool.description,
        annotations: { readOnlyHint: tool.readOnly, destructiveHint: false, openWorldHint: false },
      }, async () => contextTool(caller))
    }
  })
}

let jwks: { url: string; get: ReturnType<typeof remoteJwks> } | null = null

async function gated(req: Request) {
  if (process.env.VERCEL_ENV !== "production") return Response.json({ error: "The 434 connector runs only in Production" }, { status: 423 })
  const { config, problems } = loadConnectorConfig(process.env, CONNECTOR_434_ENV_PREFIX)
  if (!config) {
    console.error("[connector-434] not configured:", problems.join(","))
    return Response.json({ error: "The 434 connector is not switched on" }, { status: 503 })
  }
  if (!jwks || jwks.url !== config.jwksUrl) jwks = { url: config.jwksUrl, get: remoteJwks(config.jwksUrl) }
  const keys = jwks
  return withMcpAuth(async (authed: Request) => {
    const caller = callerOf(authed.auth as AuthInfo & { extra?: Record<string, unknown> })
    if (!caller) return Response.json({ error: "Not signed in to the 434 connector" }, { status: 401 })
    return serverFor(caller)(authed)
  }, (_req, bearer) => verifyConnectorToken(bearer, {
    config, jwks: keys.get, scopes: [CONNECTOR_434_SCOPE],
    authorize: (email) => authorizeAdminSignIn(email, "google"),
    // Any active roster role may connect; each tool decides what the person may run.
    sendCapable: async () => true,
    nowSeconds: () => Math.floor(Date.now() / 1000),
    onRefuse: (reason) => console.warn("[connector-434] refused:", reason),
  }), { required: true, requiredScopes: [CONNECTOR_434_SCOPE], resourceMetadataPath: "/api/434/oauth-protected-resource" })(req)
}

export { gated as GET, gated as POST }
